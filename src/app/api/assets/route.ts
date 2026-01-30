import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationService } from '@/lib/services/integration-service.server';
import { Asset } from '@/lib/database/models';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      email,
      assetType,
      name,
      description,
      location,
      valuation,
      currency,
      documents
    } = body;

    // Validate required fields
    if (!walletAddress || !name || !valuation) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, name, valuation' },
        { status: 400 }
      );
    }

    // Validate email for collateralization
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required for asset collateralization' },
        { status: 400 }
      );
    }

    const integrationService = getIntegrationService();

    // Generate unique token ID
    const tokenId = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create asset in database
    const assetData: Omit<Asset, '_id' | 'createdAt' | 'updatedAt'> = {
      tokenId,
      owner: walletAddress,
      assetType: assetType || 'other',
      name,
      description: description || '',
      location: location || 'Unknown',
      valuation: parseFloat(valuation),
      currency: currency || 'USD',
      status: 'pending',
      documents: documents || []
    };

    const assetId = await integrationService.createAsset(assetData);

    // Update user with email if provided
    // This would typically be done through a separate user management system
    // For now, we'll just log it
    console.log(`Asset created for user ${walletAddress} with email ${email}`);

    // Record the asset creation transaction
    await integrationService.recordTransaction({
      hash: `create_asset_${tokenId}`,
      userId: walletAddress,
      type: 'tokenize',
      amount: parseFloat(valuation),
      currency: currency || 'USD',
      status: 'confirmed',
      metadata: {
        assetId,
        tokenId,
        email,
        assetType
      }
    });

    return NextResponse.json({
      success: true,
      assetId,
      tokenId,
      message: 'Asset created successfully and pending verification'
    });

  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    );
  }
}

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
      assets: userData.assets
    });

  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenId, status, verificationData } = body;

    if (!tokenId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: tokenId, status' },
        { status: 400 }
      );
    }

    const integrationService = getIntegrationService();
    await integrationService.updateAssetStatus(tokenId, status, verificationData);

    return NextResponse.json({
      success: true,
      message: 'Asset status updated successfully'
    });

  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}