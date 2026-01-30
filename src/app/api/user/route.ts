import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationService } from '@/lib/services/integration-service.server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress parameter is required' },
        { status: 400 }
      );
    }

    const integrationService = getIntegrationService();
    const userData = await integrationService.getUserData(walletAddress);

    return NextResponse.json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, email } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const integrationService = getIntegrationService();
    
    // Sync user data from blockchain to MongoDB
    await integrationService.syncUserDataToMongoDB(walletAddress);

    return NextResponse.json({
      success: true,
      message: 'User data synced successfully'
    });

  } catch (error) {
    console.error('Error syncing user data:', error);
    return NextResponse.json(
      { error: 'Failed to sync user data' },
      { status: 500 }
    );
  }
}