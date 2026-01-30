/**
 * Client-side Integration Service
 * Provides mock data for client-side rendering
 */

export interface UserData {
  walletAddress: string;
  stakingMetrics: {
    totalStaked: number;
    currentValue: number;
    totalRewards: number;
    exchangeRate: number;
    apr: number;
    unbondingAmount: number;
    activePositions: number;
  };
  lendingPosition: {
    deposits: string;
    borrows: string;
    collateral: string;
    healthFactor: number;
    liquidationThreshold: number;
  };
  assets: any[];
  transactions: any[];
}

export interface OverviewData {
  totalValueLocked: number;
  totalStakers: number;
  averageAPR: number;
  activeValidators: number;
  networkStakingRatio: number;
  lendingPools: {
    totalDeposits: string;
    totalBorrows: string;
    utilizationRate: number;
    depositAPY: number;
    borrowAPY: number;
    availableLiquidity: string;
  };
}

class IntegrationService {
  async getUserData(walletAddress: string): Promise<UserData> {
    // Return mock data for client-side
    return {
      walletAddress,
      stakingMetrics: {
        totalStaked: 0,
        currentValue: 0,
        totalRewards: 0,
        exchangeRate: 1.0,
        apr: 0,
        unbondingAmount: 0,
        activePositions: 0
      },
      lendingPosition: {
        deposits: '0',
        borrows: '0',
        collateral: '0',
        healthFactor: 0,
        liquidationThreshold: 0
      },
      assets: [],
      transactions: []
    };
  }

  async getOverviewData(): Promise<OverviewData> {
    // Return mock data for client-side
    return {
      totalValueLocked: 0,
      totalStakers: 0,
      averageAPR: 0,
      activeValidators: 0,
      networkStakingRatio: 0,
      lendingPools: {
        totalDeposits: '0',
        totalBorrows: '0',
        utilizationRate: 0,
        depositAPY: 0,
        borrowAPY: 0,
        availableLiquidity: '0'
      }
    };
  }
}

let integrationService: IntegrationService | null = null;

export function getIntegrationService(): IntegrationService {
  if (!integrationService) {
    integrationService = new IntegrationService();
  }
  return integrationService;
}