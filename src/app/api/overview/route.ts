import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationService } from '@/lib/services/integration-service.server';

export async function GET(request: NextRequest) {
  try {
    const integrationService = getIntegrationService();
    const overviewData = await integrationService.getOverviewData();

    return NextResponse.json({
      success: true,
      data: overviewData
    });

  } catch (error) {
    console.error('Error fetching overview data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview data' },
      { status: 500 }
    );
  }
}