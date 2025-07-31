# Google Meet Integration Setup Guide

## Overview

This application has been upgraded to use Google Meet instead of Whereby for video consultations. This provides better integration with Google Calendar, automatic meeting link generation, and professional scheduling features.

## Required Environment Variables

Add these to your `.env.local` file:

```env
# Google Calendar & OAuth Configuration
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-auth?action=callback
GOOGLE_REFRESH_TOKEN=your_google_refresh_token

# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail_address@gmail.com
SMTP_PASS=your_gmail_app_password
```

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the consent screen if prompted
4. Choose "Web Application" as the application type
5. Add authorized redirect URIs:
   - For development: `http://localhost:3000/api/google-auth?action=callback`
   - For production: `https://yourdomain.com/api/google-auth?action=callback`
6. Save and copy the Client ID and Client Secret

### 3. Get Refresh Token

1. Use the Google OAuth 2.0 Playground or create a simple script to get a refresh token
2. Alternatively, run the app and visit `/api/google-auth?action=auth` to get tokens
3. Store the refresh token securely in your environment variables

## Gmail App Password Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account settings > Security
3. Under "Signing in to Google", select "App passwords"
4. Generate a new app password for "Mail"
5. Use this password in the `SMTP_PASS` environment variable

## Features

### 🎯 Key Features

- **Automatic Google Meet Links**: Every consultation gets a unique Google Meet link
- **Calendar Integration**: Events are automatically added to Google Calendar
- **Email Notifications**: Confirmation emails with meeting details
- **Time Slot Management**: Intelligent scheduling with conflict detection
- **Reminder System**: Automatic reminders before meetings
- **Professional Interface**: Clean booking interface with date/time selection

### 📅 Booking Flow

1. User selects a date from the calendar
2. Available time slots are shown (9 AM - 6 PM, weekdays only)
3. User selects a time slot and confirms booking
4. Google Calendar event is created with Meet link
5. Confirmation email is sent with meeting details
6. Reminder email sent 10 minutes before meeting

### ⏰ Business Rules

- **40-minute sessions** with 5-minute breaks between appointments
- **Weekdays only** (Monday to Friday)
- **Business hours**: 9 AM to 6 PM
- **24-hour advance booking** required
- **Automatic conflict detection** with existing calendar events

## API Endpoints

### Authentication
- `GET /api/google-auth?action=auth` - Get OAuth consent URL
- `GET /api/google-auth?action=callback&code=...` - Handle OAuth callback

### Calendar Operations
- `GET /api/google-calendar?action=days&year=2024&month=1` - Get bookable days
- `GET /api/google-calendar?action=timeslots&year=2024&month=1&day=15` - Get available time slots
- `POST /api/google-calendar` - Book a consultation

### Example Booking Request
```json
{
  "action": "book",
  "serviceRequestId": "req_123",
  "userId": "user_456",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "year": 2024,
  "month": 1,
  "day": 15,
  "hour": 10,
  "minute": 0,
  "summary": "Digital Marketing Consultation",
  "description": "Discussion about SEO strategy"
}
```

## Database Schema

### New Collection: `googleMeetConsults`
```javascript
{
  serviceRequestId: string,
  userId: string,
  userName: string,
  userEmail: string,
  providerId: string,
  providerName: string,
  googleEventId: string,
  meetLink: string,
  startTime: string (ISO),
  endTime: string (ISO),
  status: 'scheduled' | 'completed' | 'cancelled',
  createdAt: Timestamp
}
```

### Updated `serviceRequests` Collection
```javascript
{
  // ... existing fields
  meetingUrl: string, // Google Meet link
  googleEventId: string, // Google Calendar event ID
  consultationTime: Timestamp
}
```

## Troubleshooting

### Common Issues

**"Google Calendar not authenticated"**
- Visit `/api/google-auth?action=auth` to re-authenticate
- Check that your OAuth credentials are correct

**"Email not sending"**
- Verify Gmail app password is correct
- Ensure 2FA is enabled on Gmail account
- Check SMTP configuration

**"No available time slots"**
- Ensure you're checking weekdays only
- Verify the date is at least 24 hours in advance
- Check for calendar conflicts

**"OAuth errors"**
- Verify redirect URI matches exactly
- Check that Google Calendar API is enabled
- Ensure OAuth consent screen is configured

## Migration Notes

### Changes from Whereby Integration

- ✅ Replaced `SimpleVideoCall` component with `GoogleMeetBooking`
- ✅ Updated meeting page to use Google Meet flow
- ✅ New Google Calendar service for meeting management
- ✅ Updated email templates for Google Meet
- ✅ New database schema for Google Meet consultations
- ✅ Removed Whereby SDK dependencies

### Backward Compatibility

The `scheduleWebRtcConsultation` function is maintained for backward compatibility but now creates Google Meet consultations instead of Whereby rooms.

## Security Considerations

- Store OAuth tokens securely
- Use environment variables for sensitive data
- Implement proper error handling
- Validate all user inputs
- Use HTTPS in production
- Regularly rotate API keys and tokens

## Support

For issues or questions about the Google Meet integration:

1. Check the Google Cloud Console for API quotas and errors
2. Review the application logs for detailed error messages
3. Verify all environment variables are set correctly
4. Test the OAuth flow manually if needed

---

**Note**: This integration requires a Google account with Calendar API access. The free tier should be sufficient for most use cases.