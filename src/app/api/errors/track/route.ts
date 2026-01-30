import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
// In production, this would be sent to a proper error tracking service
const errorLogs: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Add metadata
    const logEntry = {
      ...errorData,
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      receivedAt: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    };

    // Store error log
    errorLogs.push(logEntry);
    
    // Keep only last 1000 errors in memory
    if (errorLogs.length > 1000) {
      errorLogs.splice(0, errorLogs.length - 1000);
    }

    // In production, you would send this to your error tracking service
    console.log('Error tracked:', logEntry);

    return NextResponse.json({
      success: true,
      message: 'Error tracked successfully',
    });
  } catch (error) {
    console.error('Failed to track error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');

    let filteredLogs = [...errorLogs];

    if (severity) {
      filteredLogs = filteredLogs.filter(log => log.error?.severity === severity);
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.error?.category === category);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    // Limit results
    const results = filteredLogs.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        errors: results,
        total: filteredLogs.length,
        summary: {
          critical: errorLogs.filter(log => log.error?.severity === 'critical').length,
          high: errorLogs.filter(log => log.error?.severity === 'high').length,
          medium: errorLogs.filter(log => log.error?.severity === 'medium').length,
          low: errorLogs.filter(log => log.error?.severity === 'low').length,
        },
      },
    });
  } catch (error) {
    console.error('Failed to retrieve error logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve error logs' },
      { status: 500 }
    );
  }
}