import axios from 'axios';
import db from '../db/client';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details?: any;
}

interface TransactionValidation {
  txHash: string;
  blockNumber: number;
  isValid: boolean;
  errors: string[];
  expectedRewards?: string;
  actualRewards?: string;
  exchangeRateConsistent?: boolean;
}

class RewardValidator {
  private apiUrl: string;
  private contractAddress: string;
  private botAccount: string;

  constructor() {
    this.apiUrl = process.env.PARTISIA_API_URL || 'https://reader.partisiablockchain.com';
    this.contractAddress = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
    this.botAccount = '000016e01e04096e52e0a6021e877f01760552abfb';
  }

  // Validate a specific reward transaction against blockchain data
  async validateRewardTransaction(txHash: string): Promise<TransactionValidation> {
    console.log(`🔍 Validating reward transaction: ${txHash}`);

    const result: TransactionValidation = {
      txHash,
      blockNumber: 0,
      isValid: true,
      errors: []
    };

    try {
      // Get transaction from our database
      const dbResult = await db.query(`
        SELECT * FROM reward_transactions
        WHERE tx_hash = $1
      `, [txHash]);

      if (dbResult.rows.length === 0) {
        result.errors.push('Transaction not found in reward database');
        result.isValid = false;
        return result;
      }

      const dbTx = dbResult.rows[0];
      result.blockNumber = dbTx.block_number;

      // Fetch original transaction from blockchain
      const blockchainTx = await this.fetchTransactionFromBlockchain(txHash);
      if (!blockchainTx) {
        result.errors.push('Transaction not found on blockchain');
        result.isValid = false;
        return result;
      }

      // Validate transaction properties
      await this.validateTransactionProperties(dbTx, blockchainTx, result);

      // Validate reward amounts
      await this.validateRewardAmounts(dbTx, blockchainTx, result);

      // Validate exchange rate changes
      await this.validateExchangeRateChanges(dbTx, result);

      // Validate bot account permissions
      await this.validateBotAccountPermissions(dbTx, result);

      console.log(`${result.isValid ? '✅' : '❌'} Validation complete for ${txHash}: ${result.errors.length} errors`);

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  private async fetchTransactionFromBlockchain(txHash: string): Promise<any | null> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/chain/shards/2/transactions/${txHash}`,
        { timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching transaction ${txHash}:`, error.message);
      return null;
    }
  }

  private async validateTransactionProperties(dbTx: any, blockchainTx: any, result: TransactionValidation) {
    // Validate block number
    if (blockchainTx.executionStatus?.blockId && blockchainTx.executionStatus.blockId !== dbTx.block_number) {
      result.errors.push(`Block number mismatch: DB has ${dbTx.block_number}, blockchain has ${blockchainTx.executionStatus.blockId}`);
      result.isValid = false;
    }

    // Validate timestamp (allow some tolerance for block time estimation)
    if (blockchainTx.timestamp) {
      const blockchainTime = new Date(blockchainTx.timestamp);
      const dbTime = new Date(dbTx.timestamp);
      const timeDiff = Math.abs(blockchainTime.getTime() - dbTime.getTime());

      if (timeDiff > 300000) { // 5 minutes tolerance
        result.errors.push(`Timestamp mismatch: difference of ${Math.round(timeDiff / 1000)} seconds`);
        result.isValid = false;
      }
    }

    // Validate contract involvement
    if (blockchainTx.content) {
      const content = Buffer.from(blockchainTx.content, 'base64').toString('hex');
      if (!content.includes(this.contractAddress.replace('0x', ''))) {
        result.errors.push('Transaction does not involve the liquid staking contract');
        result.isValid = false;
      }
    }
  }

  private async validateRewardAmounts(dbTx: any, blockchainTx: any, result: TransactionValidation) {
    try {
      // Calculate expected rewards based on state changes
      const expectedRewards = await this.calculateExpectedRewards(dbTx.block_number);
      result.expectedRewards = expectedRewards;
      result.actualRewards = dbTx.user_rewards;

      if (expectedRewards && dbTx.user_rewards) {
        const expected = parseFloat(expectedRewards);
        const actual = parseFloat(dbTx.user_rewards);
        const tolerance = expected * 0.01; // 1% tolerance

        if (Math.abs(expected - actual) > tolerance) {
          result.errors.push(`Reward amount mismatch: expected ~${expected}, got ${actual}`);
          result.isValid = false;
        }
      }

      // Validate that rewards are positive for accrue actions
      if (dbTx.action_type === 'accrue' && parseFloat(dbTx.user_rewards) <= 0) {
        result.errors.push('Accrue action should have positive reward amount');
        result.isValid = false;
      }

    } catch (error) {
      result.errors.push(`Error validating reward amounts: ${error.message}`);
    }
  }

  private async calculateExpectedRewards(blockNumber: number): Promise<string | null> {
    try {
      // Get exchange rate before and after the transaction
      const beforeResult = await db.query(`
        SELECT * FROM exchange_rate_snapshots
        WHERE block_number < $1
        ORDER BY block_number DESC
        LIMIT 1
      `, [blockNumber]);

      const afterResult = await db.query(`
        SELECT * FROM exchange_rate_snapshots
        WHERE block_number >= $1
        ORDER BY block_number ASC
        LIMIT 1
      `, [blockNumber]);

      if (beforeResult.rows.length === 0 || afterResult.rows.length === 0) {
        return null;
      }

      const before = beforeResult.rows[0];
      const after = afterResult.rows[0];

      const rateDiff = parseFloat(after.exchange_rate) - parseFloat(before.exchange_rate);
      if (rateDiff <= 0) {
        return '0';
      }

      // Calculate rewards: rate_difference * total_liquid_tokens
      const totalLiquid = parseFloat(before.total_pool_liquid);
      const expectedRewards = rateDiff * totalLiquid;

      return expectedRewards.toString();
    } catch (error) {
      console.error('Error calculating expected rewards:', error.message);
      return null;
    }
  }

  private async validateExchangeRateChanges(dbTx: any, result: TransactionValidation) {
    try {
      if (dbTx.exchange_rate_before && dbTx.exchange_rate_after) {
        const rateBefore = parseFloat(dbTx.exchange_rate_before);
        const rateAfter = parseFloat(dbTx.exchange_rate_after);

        // For accrue rewards, rate should increase or stay the same
        if (dbTx.action_type === 'accrue' && rateAfter < rateBefore) {
          result.errors.push('Exchange rate decreased during accrue action');
          result.isValid = false;
        }

        // Validate that rate change is reasonable (not too large)
        const rateChange = Math.abs((rateAfter - rateBefore) / rateBefore);
        if (rateChange > 0.1) { // 10% change seems excessive for single transaction
          result.errors.push(`Exchange rate change of ${(rateChange * 100).toFixed(2)}% seems excessive`);
          result.isValid = false;
        }

        result.exchangeRateConsistent = true;
      }
    } catch (error) {
      result.errors.push(`Error validating exchange rate changes: ${error.message}`);
    }
  }

  private async validateBotAccountPermissions(dbTx: any, result: TransactionValidation) {
    // Only the bot account should be able to perform accrue rewards
    if (dbTx.action_type === 'accrue' && dbTx.initiator_address !== this.botAccount) {
      result.errors.push(`Only bot account ${this.botAccount} should perform accrue actions, but found ${dbTx.initiator_address}`);
      result.isValid = false;
    }

    // Bot account actions should be marked correctly
    if (dbTx.initiator_address === this.botAccount && !dbTx.is_bot_account) {
      result.errors.push('Transaction from bot account not marked as bot action');
      result.isValid = false;
    }
  }

  // Validate reward indexing consistency over a time period
  async validateRewardConsistency(startDate: Date, endDate: Date): Promise<ValidationResult> {
    console.log(`🔍 Validating reward consistency from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Get all reward transactions in the period
      const rewardTxs = await db.query(`
        SELECT * FROM reward_transactions
        WHERE timestamp BETWEEN $1 AND $2
        ORDER BY timestamp ASC
      `, [startDate, endDate]);

      // Get all exchange rate snapshots in the period
      const rateSnapshots = await db.query(`
        SELECT * FROM exchange_rate_snapshots
        WHERE timestamp BETWEEN $1 AND $2
        ORDER BY timestamp ASC
      `, [startDate, endDate]);

      console.log(`Found ${rewardTxs.rows.length} reward transactions and ${rateSnapshots.rows.length} rate snapshots`);

      // Validate that rewards correlate with exchange rate increases
      let totalRewardsAccrued = 0;
      let totalRateIncrease = 0;

      for (const tx of rewardTxs.rows) {
        if (tx.action_type === 'accrue') {
          totalRewardsAccrued += parseFloat(tx.user_rewards || '0');

          if (tx.exchange_rate_before && tx.exchange_rate_after) {
            const rateIncrease = parseFloat(tx.exchange_rate_after) - parseFloat(tx.exchange_rate_before);
            if (rateIncrease > 0) {
              totalRateIncrease += rateIncrease;
            }
          }
        }
      }

      // Validate overall consistency
      if (totalRewardsAccrued > 0 && totalRateIncrease <= 0) {
        result.errors.push('Found reward accruals but no corresponding exchange rate increases');
        result.isValid = false;
      }

      // Check for gaps in monitoring
      const gaps = await this.findMonitoringGaps(startDate, endDate);
      if (gaps.length > 0) {
        result.warnings.push(`Found ${gaps.length} monitoring gaps`);
        result.details = { gaps };
      }

      // Validate bot account activity patterns
      const botValidation = await this.validateBotActivityPatterns(startDate, endDate);
      if (!botValidation.isValid) {
        result.errors.push(...botValidation.errors);
        result.isValid = false;
      }

      console.log(`✅ Consistency validation complete: ${result.errors.length} errors, ${result.warnings.length} warnings`);

    } catch (error) {
      result.errors.push(`Consistency validation error: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  private async findMonitoringGaps(startDate: Date, endDate: Date): Promise<Array<{ start: Date, end: Date, duration: number }>> {
    const gaps = [];

    try {
      const snapshots = await db.query(`
        SELECT timestamp
        FROM exchange_rate_snapshots
        WHERE timestamp BETWEEN $1 AND $2
        ORDER BY timestamp ASC
      `, [startDate, endDate]);

      for (let i = 1; i < snapshots.rows.length; i++) {
        const prev = new Date(snapshots.rows[i - 1].timestamp);
        const curr = new Date(snapshots.rows[i].timestamp);
        const gapDuration = curr.getTime() - prev.getTime();

        // Consider gaps longer than 1 hour as significant
        if (gapDuration > 3600000) {
          gaps.push({
            start: prev,
            end: curr,
            duration: gapDuration
          });
        }
      }
    } catch (error) {
      console.error('Error finding monitoring gaps:', error.message);
    }

    return gaps;
  }

  private async validateBotActivityPatterns(startDate: Date, endDate: Date): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Get bot actions in the period
      const botActions = await db.query(`
        SELECT * FROM bot_account_actions
        WHERE timestamp BETWEEN $1 AND $2
        ORDER BY timestamp ASC
      `, [startDate, endDate]);

      // Check for unusual patterns
      const dailyActionCounts = new Map<string, number>();

      for (const action of botActions.rows) {
        const date = new Date(action.timestamp).toISOString().split('T')[0];
        dailyActionCounts.set(date, (dailyActionCounts.get(date) || 0) + 1);
      }

      // Look for days with unusually high or low activity
      const avgDaily = Array.from(dailyActionCounts.values()).reduce((a, b) => a + b, 0) / dailyActionCounts.size;

      for (const [date, count] of Array.from(dailyActionCounts.entries())) {
        if (count > avgDaily * 3) {
          result.warnings.push(`Unusually high bot activity on ${date}: ${count} actions`);
        } else if (count === 0) {
          result.warnings.push(`No bot activity on ${date}`);
        }
      }

      // Check success rate
      const totalActions = botActions.rows.length;
      const successfulActions = botActions.rows.filter(a => a.success).length;
      const successRate = totalActions > 0 ? successfulActions / totalActions : 1;

      if (successRate < 0.95) {
        result.errors.push(`Bot success rate too low: ${(successRate * 100).toFixed(1)}%`);
        result.isValid = false;
      }

    } catch (error) {
      result.errors.push(`Bot activity validation error: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  // Test the specific transaction mentioned in the task description
  async validateSpecificTransaction(): Promise<ValidationResult> {
    const testTxHash = 'aaa7919f199cc2c1a8b63dac2a4a5591e7c9e0b553f70794ffb5a83e4fe9b2b7';

    console.log(`🎯 Validating specific test transaction: ${testTxHash}`);

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const validation = await this.validateRewardTransaction(testTxHash);

      result.isValid = validation.isValid;
      result.errors = validation.errors;
      result.details = {
        transaction_validation: validation
      };

      if (validation.isValid) {
        console.log('✅ Test transaction validation passed');
      } else {
        console.log('❌ Test transaction validation failed');
      }

    } catch (error) {
      result.errors.push(`Test transaction validation error: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  // Generate a comprehensive validation report
  async generateValidationReport(): Promise<any> {
    console.log('📊 Generating comprehensive validation report');

    const report = {
      timestamp: new Date().toISOString(),
      overall_status: 'healthy',
      validations: {
        recent_transactions: null,
        consistency_check: null,
        bot_performance: null,
        specific_transaction: null
      },
      statistics: {
        total_reward_transactions: 0,
        total_bot_actions: 0,
        success_rate: 0,
        avg_reward_amount: 0
      },
      recommendations: []
    };

    try {
      // Validate recent transactions (last 7 days)
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      report.validations.consistency_check = await this.validateRewardConsistency(startDate, endDate);

      // Validate specific test transaction
      report.validations.specific_transaction = await this.validateSpecificTransaction();

      // Get statistics
      const statsResult = await db.query(`
        SELECT
          COUNT(*) as total_reward_transactions,
          AVG(CAST(user_rewards AS NUMERIC)) as avg_reward_amount
        FROM reward_transactions
        WHERE timestamp > NOW() - INTERVAL '30 days'
      `);

      const botStatsResult = await db.query(`
        SELECT
          COUNT(*) as total_bot_actions,
          COUNT(*) FILTER (WHERE success = true)::float / COUNT(*)::float as success_rate
        FROM bot_account_actions
        WHERE timestamp > NOW() - INTERVAL '30 days'
      `);

      if (statsResult.rows.length > 0) {
        report.statistics.total_reward_transactions = parseInt(statsResult.rows[0].total_reward_transactions);
        report.statistics.avg_reward_amount = parseFloat(statsResult.rows[0].avg_reward_amount) || 0;
      }

      if (botStatsResult.rows.length > 0) {
        report.statistics.total_bot_actions = parseInt(botStatsResult.rows[0].total_bot_actions);
        report.statistics.success_rate = parseFloat(botStatsResult.rows[0].success_rate) || 0;
      }

      // Determine overall status
      const hasErrors = Object.values(report.validations).some(v => v && !v.isValid);
      report.overall_status = hasErrors ? 'issues_detected' : 'healthy';

      // Generate recommendations
      if (report.statistics.success_rate < 0.95) {
        report.recommendations.push('Bot success rate is below 95% - investigate failed transactions');
      }

      if (report.validations.consistency_check && report.validations.consistency_check.warnings.length > 0) {
        report.recommendations.push('Monitoring gaps detected - consider increasing monitoring frequency');
      }

      console.log(`📋 Validation report complete: ${report.overall_status}`);

    } catch (error) {
      console.error('Error generating validation report:', error);
      report.overall_status = 'error';
      // Store error in a proper validation result
      (report as any).error = error instanceof Error ? error.message : String(error);
    }

    return report;
  }
}

export default new RewardValidator();