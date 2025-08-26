export default {
  blockchain: {
    environment: process.env.ENVIRONMENT || "TESTNET",
    apiBaseUrl: (process.env.PARTISIA_API_URL || "https://node1.testnet.partisiablockchain.com").replace(/\/$/, ""),
    contractAddress: process.env.LS_CONTRACT || "",
    mpcToken: process.env.MPC_TOKEN || "",
    mpc20Token: process.env.MPC20_TOKEN || "",
    botAccount: process.env.BOT_ACCOUNT || "",
    botPK: process.env.BOT_PRIVATE_KEY || "",
    bufferAccount: process.env.BUFFER_ACCOUNT || "",
    bufferAccountPK: process.env.BUFFER_PRIVATE_KEY || "",
    nodeMaxAllocation: process.env.NODE_MAX_ALLOCATION ? BigInt(process.env.NODE_MAX_ALLOCATION) : 5000000n,
    minDelegation: process.env.MIN_DELEGATION_MPC ? BigInt(process.env.MIN_DELEGATION_MPC)*10000n : 1000000n,
    maxDelegation: process.env.MAX_DELEGATION_MPC ? BigInt(process.env.MAX_DELEGATION_MPC)*10000n : 1000000000n,
    minContractBuffer: process.env.MIN_CONTRACT_BUFFER ? BigInt(process.env.MIN_CONTRACT_BUFFER) : 100n,
    excludeZKNodes: process.env.EXCLUDE_ZK_NODES === 'true',
    minAcceptancePct: process.env.MIN_ACCEPTANCE_PCT ? parseInt(process.env.MIN_ACCEPTANCE_PCT) : 70,
    fullBufferSize: process.env.BUFFER_AMOUNT_MPC ? BigInt(process.env.BUFFER_AMOUNT_MPC)*10000n : 0n,
    bufferMinLevel: process.env.BUFFER_MIN_LEVEL_MPC ? BigInt(process.env.BUFFER_MIN_LEVEL_MPC)*10000n : 0n,
    gasMinContract: process.env.MIN_CONTRACT_GAS_BALANCE ? BigInt(process.env.MIN_CONTRACT_GAS_BALANCE) : 1000000n,
    gasMinBot: process.env.MIN_BOT_GAS_BALANCE ? BigInt(process.env.MIN_BOT_GAS_BALANCE) : 1000000n,
    gasMinBuffer: process.env.MIN_BUFFER_GAS_BALANCE ? BigInt(process.env.MIN_BUFFER_GAS_BALANCE) : 1000000n,
    minTransfer: process.env.MIN_TRANSFER_MPC ? BigInt(process.env.MIN_TRANSFER_MPC) * 10000n : 100000n,
  },
  intervals: {
    cashFlowCalcInterval: process.env.LOOP_INTERVAL_S ? parseInt(process.env.LOOP_INTERVAL_S) : 60,
    rebalancerInterval: process.env.REBALANCER_INTERVAL_S ? parseInt(process.env.REBALANCER_INTERVAL_S) : 1800,
    cooldownPeriod: process.env.COOLDOWN_PERIOD_S ? parseInt(process.env.COOLDOWN_PERIOD_S) : 300,
    redemptionPeriod: process.env.REDEMPTION_PERIOD_S ? parseInt(process.env.REDEMPTION_PERIOD_S) : 180,
    maxPendingDelegatedPeriod: process.env.MAX_PENDING_DELEGATED_S ? parseInt(process.env.MAX_PENDING_DELEGATED_S) : 86400,
    nodeBlacklistingPeriod: process.env.NODE_BLACKLISTING_PERIOD_S ? parseInt(process.env.NODE_BLACKLISTING_PERIOD_S) : 3600,
    delegationExpirationPeriod: process.env.DELEGATION_EXPIRATION_DAYS ? parseInt(process.env.DELEGATION_EXPIRATION_DAYS) * 24 * 60 * 60 : 14 * 24 * 60 * 60,
  },
  logging: {
    level: process.env.LOG_LEVEL || "info"
  }
};
