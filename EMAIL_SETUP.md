# Email Setup Guide - Nodemailer Integration

This guide explains how to set up Nodemailer for sending email notifications to users when they submit requests or schedule consultations.

## 🚀 Features

- **Request Confirmation Emails**: Users receive detailed emails with their request information
- **Consultation Scheduling Emails**: Users get notified when video consultations are scheduled
- **Bilingual Support**: Emails are sent in both Arabic and English
- **Rich HTML Templates**: Beautiful, responsive email templates
- **Error Handling**: Graceful error handling with fallbacks

## 📧 Email Templates

### 1. Request Confirmation Email
Sent when a user submits a service request, including:
- Request ID for tracking
- Complete request details
- Selected time slots
- Problem description
- Contact information

### 2. Consultation Scheduling Email
Sent when a video consultation is scheduled, including:
- Consultation ID
- Room ID and meeting link
- Scheduled time
- Important instructions

## ⚙️ Configuration

### 1. Environment Variables

Add the following variables to your `.env.local` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 2. Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password in `SMTP_PASS`

### 3. Other Email Providers

You can use any SMTP provider. Here are some common configurations:

#### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

#### Yahoo
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

#### Custom SMTP Server
```bash
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
```

## 🧪 Testing

### 1. Test Page
Visit `/test-email` to test the email functionality:
- Test SMTP connection
- Send test emails
- Verify configuration

### 2. Manual Testing
1. Submit a service request through the form
2. Check if confirmation email is received
3. Schedule a video consultation
4. Verify consultation email is sent

## 📁 File Structure

```
src/
├── lib/
│   └── email.ts              # Email service configuration
├── components/
│   └── forms/
│       └── actions.ts        # Form submission with email
├── app/
│   ├── meeting/
│   │   └── actions.ts        # Consultation scheduling with email
│   └── test-email/
│       ├── page.tsx          # Email testing interface
│       └── actions.ts        # Test email actions
```

## 🔧 Email Service Functions

### `emailService.sendRequestConfirmation(data)`
Sends a confirmation email when a user submits a request.

**Parameters:**
- `name`: User's full name
- `requestId`: Unique request identifier
- `serviceType`: Type of service (coaching/consultation)
- `meetingType`: Meeting type (online/in-person)
- `problemDescription`: User's problem description
- `selectedSlots`: Array of selected time slots
- `email`: User's email address
- `phone`: User's phone number
- `createdAt`: Request creation timestamp

### `emailService.sendConsultationScheduled(data)`
Sends an email when a video consultation is scheduled.

**Parameters:**
- `name`: User's full name
- `roomId`: Video call room ID
- `consultId`: Consultation ID
- `serviceRequestId`: Original request ID
- `consultationTime`: Scheduled consultation time
- `email`: User's email address

### `emailService.testConnection()`
Tests the SMTP connection configuration.

## 🎨 Email Templates

### HTML Templates
- Responsive design
- Bilingual support (Arabic/English)
- Professional styling
- Mobile-friendly layout

### Text Templates
- Plain text fallback
- Bilingual content
- Essential information only

## 🛠️ Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify SMTP credentials
   - Check if 2FA is enabled for Gmail
   - Use App Password instead of regular password

2. **Connection Timeout**
   - Check firewall settings
   - Verify SMTP host and port
   - Try different SMTP providers

3. **Emails Not Sending**
   - Check server logs for errors
   - Verify environment variables
   - Test connection using `/test-email`

### Debug Mode

Enable debug logging by adding to your `.env.local`:
```bash
DEBUG=nodemailer:*
```

## 🔒 Security Considerations

1. **Environment Variables**: Never commit SMTP credentials to version control
2. **App Passwords**: Use app-specific passwords for Gmail
3. **Rate Limiting**: Implement rate limiting for email sending
4. **Error Handling**: Don't expose sensitive information in error messages

## 📊 Monitoring

### Email Delivery Tracking
- Check email service logs
- Monitor bounce rates
- Track delivery success rates

### Performance Monitoring
- Email sending response times
- Queue processing times
- Error rates

## 🚀 Production Deployment

### Environment Variables
Ensure all SMTP variables are set in your production environment.

### Email Service Providers
Consider using dedicated email services for production:
- SendGrid
- Mailgun
- Amazon SES
- Postmark

### Rate Limiting
Implement rate limiting to prevent abuse:
- Limit emails per user per hour
- Implement cooldown periods
- Monitor for spam patterns

## 📝 Example Usage

```typescript
import { emailService } from '@/lib/email';

// Send request confirmation
const result = await emailService.sendRequestConfirmation({
  name: "John Doe",
  requestId: "REQ123456",
  serviceType: "consultation",
  meetingType: "online",
  problemDescription: "Need help with business strategy",
  selectedSlots: [
    { date: "2024-01-15", time: "10:00 AM" }
  ],
  email: "john@example.com",
  phone: "+1234567890",
  createdAt: new Date().toISOString(),
});

if (result.success) {
  console.log('Email sent successfully:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

## 📞 Support

If you encounter issues:
1. Check the test page at `/test-email`
2. Review server logs for error messages
3. Verify SMTP configuration
4. Test with different email providers

---

**Note**: This email system is designed to be robust and user-friendly, providing comprehensive information to users while maintaining professional communication standards. 