import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

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

      // Generate bookable days for the month (weekdays only, 9 AM - 6 PM)
      const days = [];
      const date = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= lastDay; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dayOfWeek = currentDate.getDay();
        
        // Only weekdays (Monday = 1, Tuesday = 2, ..., Friday = 5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          // Check if it's not today or in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          currentDate.setHours(0, 0, 0, 0);
          
          if (currentDate >= today) {
            days.push({
              day,
              date: currentDate.toISOString().split('T')[0],
              available: true
            });
          }
        }
      }

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

      // Generate time slots from 9 AM to 6 PM (40-minute slots)
      const timeSlots = [];
      const baseDate = new Date(year, month - 1, day);
      
      for (let hour = 9; hour < 18; hour++) {
        for (let minute = 0; minute < 60; minute += 40) {
          const startTime = new Date(baseDate);
          startTime.setHours(hour, minute, 0, 0);
          
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + 40);
          
          // Don't create slots that would end after 6 PM
          if (endTime.getHours() <= 18) {
            timeSlots.push({
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              available: true
            });
          }
        }
      }

      return NextResponse.json({ success: true, timeSlots });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Meeting API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Meeting operation failed' },
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

      // Generate Jitsi Meet link
      const meetingId = Math.random().toString(36).substring(2, 15);
      const meetLink = `https://meet.jit.si/ConsultationRoom-${meetingId}`;

      // Update service request with meeting details
      const requestDocRef = doc(db, "serviceRequests", serviceRequestId);
      await updateDoc(requestDocRef, {
        meetingUrl: meetLink,
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
        meetLink: meetLink,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        consultId: consultDoc.id,
        meetLink: meetLink,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Meeting booking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Booking failed' },
      { status: 500 }
    );
  }
} 