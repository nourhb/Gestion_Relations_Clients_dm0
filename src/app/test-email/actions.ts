"use server";

import { emailService } from '@/lib/email';

export async function testEmailConnection() {
  try {
    const result = await emailService.testConnection();
    return result;
  } catch (error) {
    console.error('Email connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function sendTestEmail(email: string) {
  try {
    const result = await emailService.sendRequestConfirmation({
      name: "Test User",
      requestId: "TEST123",
      serviceType: "consultation",
      meetingType: "online",
      problemDescription: "This is a test email to verify the email service is working correctly.",
      selectedSlots: [
        { date: "2024-01-15", time: "10:00 AM" },
        { date: "2024-01-16", time: "2:00 PM" }
      ],
      email: email,
      phone: "+966 50 123 4567",
      createdAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    console.error('Test email sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 