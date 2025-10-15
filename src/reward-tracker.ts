import rewardIndexer from './services/reward-indexer';
import mexcService from './services/mexc-rest-service';
import rewardValidator from './validation/reward-validator';
import db from './db/client';

interface IndexerStats {
  uptime: number;
  totalRewardTransactions: number;
  totalBotActions: number;
  lastRewardTime: Date | null;
  healthStatus: 'healthy' | 'warning' | 'error';
  validationStatus: 'passing' | 'failing' | 'unknown';
}

class RewardTracker {
  private startTime: Date;
  private isRunning = false;
  private components = {
    rewardIndexer,
    priceService: mexcService,
    validator: rewardValidator
  };

  constructor() {
    this.startTime = new Date();
    this.bindMethods();
  }

  private bindMethods() {
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.getStats = this.getStats.bind(this);
  }

  async start() {
    console.log('Starting reward tracking system');
    console.log('  ├─ Reward indexer');
    console.log('  ├─ Price service');
    console.log('  ├─ Reward validator');
    console.log('  └─ API endpoints');

    if (this.isRunning) {
      console.log('⚠️  Indexer is already running');
      return;
    }

    this.isRunning = true;

    try {
      // Ensure database schema is up to date
      await this.ensureEnhancedSchema();

      // Start reward indexing service
      console.log('🎯 Starting reward indexer...');
      await this.components.rewardIndexer.start();

      // Start price monitoring service
      console.log('💰 Starting price monitoring...');
      await this.components.priceService.start();

      // Schedule periodic validation
      this.scheduleValidation();

      // Setup health monitoring
      this.setupHealthMonitoring();

      console.log('Reward tracking system started');
      console.log('  Dashboard: /api/rewards/dashboard');
      console.log('  Health: /api/rewards/health');

    } catch (error) {
      console.error('Failed to start reward tracking system:', error.message);
      this.isRunning = false;
      throw error;
    }
  }

  private async ensureEnhancedSchema() {
    console.log('Checking reward tracking schema...');

    try {
      // Check if our enhanced tables exist
      const tableCheck = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('reward_transactions', 'exchange_rate_snapshots', 'bot_account_actions', 'reward_summary')
      `);

      const existingTables = tableCheck.rows.map(row => row.table_name);
      const requiredTables = ['reward_transactions', 'exchange_rate_snapshots', 'bot_account_actions', 'reward_summary'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        console.log(`⚠️  Missing reward tracking tables: ${missingTables.join(', ')}`);
        console.log('   Reward tracking features will be limited');
        console.log('   To enable full features, run:');
        console.log('   psql -d ls_indexer -f scripts/enhanced-schema.sql');
        // Don't throw - continue with limited functionality
        return;
      }

      console.log('✅ Enhanced database schema is ready');

    } catch (error) {
      console.error('❌ Database schema check failed:', error.message);
      throw error;
    }
  }

  private scheduleValidation() {
    console.log('⏰ Scheduling periodic validation...');

    // Run validation every hour
    setInterval(async () => {
      try {
        console.log('🔍 Running periodic validation...');
        const report = await this.components.validator.generateValidationReport();

        if (report.overall_status !== 'healthy') {
          console.log('⚠️  Validation issues detected:', report.overall_status);

          // Log specific issues
          for (const [component, validation] of Object.entries(report.validations)) {
            if (validation && !(validation as any).isValid) {
              console.log(`   ❌ ${component}: ${(validation as any).errors.join(', ')}`);
            }
          }
        } else {
          console.log('✅ Periodic validation passed');
        }

      } catch (error) {
        console.error('❌ Periodic validation failed:', error.message);
      }
    }, 3600000); // 1 hour
  }

  private setupHealthMonitoring() {
    console.log('💗 Setting up health monitoring...');

    // Monitor component health every 10 minutes
    setInterval(async () => {
      try {
        const stats = await this.getStats();

        if (stats.healthStatus === 'error') {
          console.log('🚨 Health check failed - attempting recovery...');
          await this.attemptRecovery();
        } else if (stats.healthStatus === 'warning') {
          console.log('⚠️  Health check warning detected');
        }

      } catch (error) {
        console.error('❌ Health monitoring error:', error.message);
      }
    }, 600000); // 10 minutes
  }

  private async attemptRecovery() {
    console.log('🔧 Attempting automatic recovery...');

    try {
      // Check if reward indexer is still running
      const rewardStats = await this.components.rewardIndexer.getRewardIndexingStats();

      if (rewardStats.recent_activity_24h === 0) {
        console.log('🔄 Restarting reward indexer...');
        this.components.rewardIndexer.stop();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.components.rewardIndexer.start();
      }

      // Check price service
      const priceStats = this.components.priceService.getStats();
      if (priceStats.currentBackoffMs > 60000) {
        console.log('🔄 Price service backoff too high, resetting...');
        this.components.priceService.stop();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.components.priceService.start();
      }

      console.log('✅ Recovery attempt completed');

    } catch (error) {
      console.error('❌ Recovery attempt failed:', error.message);
    }
  }

  async getStats(): Promise<IndexerStats> {
    try {
      const [rewardStats, dbHealth, lastActivity] = await Promise.all([
        this.components.rewardIndexer.getRewardIndexingStats(),
        db.query('SELECT NOW() as db_time'),
        db.query(`
          SELECT
            MAX(timestamp) as last_reward_time,
            COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as recent_activity
          FROM reward_transactions
        `)
      ]);

      const uptime = Date.now() - this.startTime.getTime();
      const lastRewardTime = lastActivity.rows[0]?.last_reward_time ?
        new Date(lastActivity.rows[0].last_reward_time) : null;

      // Determine health status
      let healthStatus: 'healthy' | 'warning' | 'error' = 'healthy';

      if (!lastRewardTime || (Date.now() - lastRewardTime.getTime()) > 7200000) { // 2 hours
        healthStatus = 'warning';
      }

      if (!this.isRunning || (Date.now() - lastRewardTime?.getTime() || 0) > 14400000) { // 4 hours
        healthStatus = 'error';
      }

      return {
        uptime,
        totalRewardTransactions: rewardStats.total_reward_transactions,
        totalBotActions: rewardStats.bot_actions,
        lastRewardTime,
        healthStatus,
        validationStatus: 'unknown' // Would be set by validation results
      };

    } catch (error) {
      console.error('Error getting indexer stats:', error.message);
      return {
        uptime: Date.now() - this.startTime.getTime(),
        totalRewardTransactions: 0,
        totalBotActions: 0,
        lastRewardTime: null,
        healthStatus: 'error',
        validationStatus: 'failing'
      };
    }
  }

  async runFullValidation(): Promise<any> {
    console.log('🔍 Running full validation suite...');

    try {
      const report = await this.components.validator.generateValidationReport();

      // Update validation status in stats
      const stats = await this.getStats();
      stats.validationStatus = report.overall_status === 'healthy' ? 'passing' : 'failing';

      console.log(`📋 Full validation complete: ${report.overall_status}`);
      console.log(`   Reward transactions: ${report.statistics.total_reward_transactions}`);
      console.log(`   Bot actions: ${report.statistics.total_bot_actions}`);
      console.log(`   Success rate: ${(report.statistics.success_rate * 100).toFixed(1)}%`);

      return {
        ...report,
        indexer_stats: stats
      };

    } catch (error) {
      console.error('❌ Full validation failed:', error.message);
      throw error;
    }
  }

  // Method to manually trigger validation of a specific transaction
  async validateTransaction(txHash: string): Promise<any> {
    console.log(`🔍 Validating specific transaction: ${txHash}`);

    try {
      const result = await this.components.validator.validateRewardTransaction(txHash);

      console.log(`${result.isValid ? '✅' : '❌'} Transaction validation: ${result.errors.length} errors`);

      return result;

    } catch (error) {
      console.error('❌ Transaction validation failed:', error.message);
      throw error;
    }
  }

  // Method to get comprehensive status for deployment verification
  async getDeploymentStatus(): Promise<any> {
    console.log('📊 Generating deployment status report...');

    try {
      const [stats, validationReport, priceStats, dbStatus] = await Promise.all([
        this.getStats(),
        this.runFullValidation(),
        Promise.resolve(this.components.priceService.getStats()),
        db.query(`
          SELECT
            (SELECT COUNT(*) FROM reward_transactions) as reward_transactions,
            (SELECT COUNT(*) FROM exchange_rate_snapshots) as rate_snapshots,
            (SELECT COUNT(*) FROM bot_account_actions) as bot_actions,
            (SELECT COUNT(*) FROM price_history) as price_history_entries
        `)
      ]);

      return {
        deployment_timestamp: new Date().toISOString(),
        indexer_status: {
          is_running: this.isRunning,
          uptime_ms: stats.uptime,
          health: stats.healthStatus
        },
        data_status: {
          reward_transactions: parseInt(dbStatus.rows[0].reward_transactions),
          exchange_rate_snapshots: parseInt(dbStatus.rows[0].rate_snapshots),
          bot_actions: parseInt(dbStatus.rows[0].bot_actions),
          price_history_entries: parseInt(dbStatus.rows[0].price_history_entries)
        },
        service_status: {
          reward_indexer: {
            total_transactions: stats.totalRewardTransactions,
            last_activity: stats.lastRewardTime
          },
          price_service: {
            requests_this_minute: priceStats.requestsThisMinute,
            requests_this_hour: priceStats.requestsThisHour,
            cache_size: priceStats.cacheSize,
            has_api_key: priceStats.hasApiKey
          }
        },
        validation_status: validationReport,
        recommendations: this.generateDeploymentRecommendations(stats, validationReport)
      };

    } catch (error) {
      console.error('❌ Deployment status generation failed:', error.message);
      throw error;
    }
  }

  private generateDeploymentRecommendations(stats: IndexerStats, validation: any): string[] {
    const recommendations = [];

    if (stats.healthStatus !== 'healthy') {
      recommendations.push('Health status is not healthy - investigate indexer issues');
    }

    if (stats.totalRewardTransactions === 0) {
      recommendations.push('No reward transactions indexed yet - verify bot account is active');
    }

    if (validation.overall_status !== 'healthy') {
      recommendations.push('Validation issues detected - review validation report');
    }

    if (validation.statistics.success_rate < 0.95) {
      recommendations.push('Bot success rate below 95% - investigate failed transactions');
    }

    if (recommendations.length === 0) {
      recommendations.push('All systems operational - deployment looks good!');
    }

    return recommendations;
  }

  async stop() {
    console.log('🛑 Stopping Enhanced Partisia Indexer...');

    this.isRunning = false;

    try {
      // Stop all components
      this.components.rewardIndexer.stop();
      this.components.priceService.stop();

      console.log('✅ Enhanced Partisia Indexer stopped');

    } catch (error) {
      console.error('❌ Error stopping indexer:', error.message);
    }
  }
}

export default new RewardTracker();