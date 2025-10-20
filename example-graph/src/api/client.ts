interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url);
    const json: ApiResponse<T> = await response.json();

    if (!json.success || !json.data) {
      throw new Error(json.error?.message || 'API request failed');
    }

    return json.data;
  }

  async getIndexerStatus(): Promise<IndexerStatus> {
    return this.request<IndexerStatus>('/api/v1/indexer/status');
  }

  async getContractCurrent(): Promise<ContractState> {
    return this.request<ContractState>('/api/v1/contract/current');
  }

  async getContractHistory(limit = 100, offset = 0): Promise<ContractHistoryResponse> {
    return this.request<ContractHistoryResponse>(`/api/v1/contract/history?limit=${limit}&offset=${offset}`);
  }

  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/api/v1/health');
  }
}

export interface IndexerStatus {
  state: {
    currentBlock: number;
    targetBlock: number;
    blocksRemaining: number;
    progressPercent: number;
    blocksPerSecond: number;
    syncComplete: boolean;
  };
  transactions: {
    currentBlock: number;
    transactionsProcessed: number;
    contractTxFound: number;
    adminTxFound: number;
  };
  overall: {
    syncing: boolean;
    healthy: boolean;
  };
}

export interface ContractState {
  blockNumber: number;
  timestamp: string;
  exchangeRate: number;
  totalPoolStakeToken: string;
  totalPoolLiquid: string;
  stakeTokenBalance: string;
  buyInPercentage: number;
  buyInEnabled: boolean;
  tvlUsd: string;
}

export interface ContractHistoryResponse {
  states: ContractState[];
  count: number;
  hasMore: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded';
  checks: {
    database: 'ok' | 'error';
    indexer: 'ok' | 'error';
  };
  uptime: number;
}

export const apiClient = new ApiClient('');
