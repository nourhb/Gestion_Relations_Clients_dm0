import { NextRequest, NextResponse } from 'next/server';
import GoogleCalendarService from '@/lib/google-calendar';

const googleCalendarService = new GoogleCalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'auth') {
      // Generate Google OAuth consent URL
      const authUrl = googleCalendarService.generateAuthUrl();
      return NextResponse.json({ success: true, authUrl });
    }

    if (action === 'callback') {
      // Handle OAuth callback
      const code = searchParams.get('code');
      
      if (!code) {
        return NextResponse.json(
          { success: false, error: 'Authorization code not provided' },
          { status: 400 }
        );
      }

      const tokens = await googleCalendarService.getTokensFromCode(code);
      
      // In a real app, you'd store these tokens in your database associated with the user
      // For now, we'll return them (in production, store securely)
      return NextResponse.json({ 
        success: true, 
        message: 'Authentication successful',
        // Don't return tokens in production - store them securely instead
        tokens: process.env.NODE_ENV === 'development' ? tokens : undefined
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Google Auth error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}