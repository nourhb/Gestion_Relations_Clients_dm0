import { NextRequest, NextResponse } from 'next/server';
import GoogleCalendarService from '@/lib/google-calendar';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

const googleCalendarService = new GoogleCalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN, // Store this securely
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'days') {
      const year = parseInt(searchParams.get('year') || '');
      const month = parseInt(searchParams.get('month') || '');

      if (!year || !month || month < 1 || month > 12) {
        return NextResponse.json(
          { success: false, error: 'Invalid year or month' },
          { status: 400 }
        );
      }

      const days = await googleCalendarService.getBookableDays(year, month);
      return NextResponse.json({ success: true, days });
    }

    if (action === 'timeslots') {
      const year = parseInt(searchParams.get('year') || '');
      const month = parseInt(searchParams.get('month') || '');
      const day = parseInt(searchParams.get('day') || '');

      if (!year || !month || !day) {
        return NextResponse.json(
          { success: false, error: 'Invalid date parameters' },
          { status: 400 }
        );
      }

      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split('T')[0];
      
      const timeSlots = await googleCalendarService.getAvailableTimeSlots(dateString);
      return NextResponse.json({ success: true, timeSlots });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Calendar operation failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'book') {
      const { 
        serviceRequestId, 
        userId, 
        userName, 
        userEmail,
        year, 
        month, 
        day, 
        hour, 
        minute,
        summary,
        description 
      } = body;

      // Validate required fields
      if (!serviceRequestId || !userId || !userName || !userEmail || 
          !year || !month || !day || hour === undefined || minute === undefined) {
        return NextResponse.json(
          { success: false, error: 'Missing required booking parameters' },
          { status: 400 }
        );
      }

      // Create the booking date/time
      const startDateTime = new Date(year, month - 1, day, hour, minute);
      const endDateTime = new Date(startDateTime.getTime() + 40 * 60000); // 40 minutes

      // Check if booking is at least 24 hours in advance
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      if (startDateTime < twentyFourHoursFromNow) {
        return NextResponse.json(
          { success: false, error: 'Cannot book with less than 24 hours in advance' },
          { status: 400 }
        );
      }

      // Check if it's within business hours (9 AM - 6 PM, weekdays)
      const dayOfWeek = startDateTime.getDay();
      const hour24 = startDateTime.getHours();
      
      if (dayOfWeek === 0 || dayOfWeek === 6 || hour24 < 9 || hour24 >= 18) {
        return NextResponse.json(
          { success: false, error: 'Cannot book outside bookable timeframe' },
          { status: 400 }
        );
      }

      // Create Google Calendar event
      const eventResult = await googleCalendarService.createEvent({
        summary: summary || `Consultation with ${userName}`,
        description: description || `Digital marketing consultation for service request ${serviceRequestId}`,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        attendeeEmail: userEmail,
        timeZone: 'UTC',
      });

      if (!eventResult.success) {
        return NextResponse.json(
          { success: false, error: eventResult.error || 'Failed to create calendar event' },
          { status: 500 }
        );
      }

      // Update service request with meeting details
      const requestDocRef = doc(db, "serviceRequests", serviceRequestId);
      await updateDoc(requestDocRef, {
        meetingUrl: eventResult.meetLink,
        googleEventId: eventResult.eventId,
        status: "confirmed",
        consultationTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create consultation record
      const consultsCollection = collection(db, "googleMeetConsults");
      const consultDoc = await addDoc(consultsCollection, {
        serviceRequestId,
        userId,
        userName,
        userEmail,
        providerId: "eQwXAu9jw7cL0YtMHA3WuQznKfg1", // Admin/Provider UID
        providerName: "DigitalMen0 دعم",
        googleEventId: eventResult.eventId,
        meetLink: eventResult.meetLink,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        consultId: consultDoc.id,
        eventId: eventResult.eventId,
        meetLink: eventResult.meetLink,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Calendar booking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Booking failed' },
      { status: 500 }
    );
  }
}