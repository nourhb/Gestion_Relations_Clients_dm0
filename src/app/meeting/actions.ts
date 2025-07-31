
"use server";

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { z } from "zod";
import { emailService } from '@/lib/email';
import GoogleCalendarService from '@/lib/google-calendar';

const scheduleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  userName: z.string().min(1, "User name is required"),
  userEmail: z.string().email("Valid email is required"),
  serviceRequestId: z.string().min(1, "Service request ID is required"),
  startDateTime: z.string().min(1, "Start date time is required"),
  endDateTime: z.string().min(1, "End date time is required"),
  summary: z.string().optional(),
  description: z.string().optional(),
});

interface ScheduleResult {
  success: boolean;
  message: string;
  meetLink?: string;
  consultId?: string;
  eventId?: string;
}

// Initialize Google Calendar service
const googleCalendarService = new GoogleCalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
});

export async function scheduleGoogleMeetConsultation(
    serviceRequestId: string, 
    userId: string, 
    userName: string,
    userEmail: string,
    startDateTime: string,
    endDateTime: string,
    summary?: string,
    description?: string
): Promise<ScheduleResult> {
  const validation = scheduleSchema.safeParse({ 
    userId, 
    userName, 
    userEmail,
    serviceRequestId,
    startDateTime,
    endDateTime,
    summary,
    description
  });

  if (!validation.success) {
    console.error("Validation error:", validation.error);
    return { success: false, message: "بيانات الجدولة المقدمة غير صالحة." };
  }
  
  const validatedData = validation.data;

  try {
    // Create Google Calendar event with Meet link
    const eventResult = await googleCalendarService.createEvent({
      summary: validatedData.summary || `Consultation with ${validatedData.userName}`,
      description: validatedData.description || `Digital marketing consultation for service request ${validatedData.serviceRequestId}`,
      startDateTime: validatedData.startDateTime,
      endDateTime: validatedData.endDateTime,
      attendeeEmail: validatedData.userEmail,
      timeZone: 'UTC',
    });

    if (!eventResult.success) {
      return {
        success: false,
        message: eventResult.error || "فشل في إنشاء حدث التقويم.",
      };
    }
    
    // Update the original service request with the meeting details
    const requestDocRef = doc(db, "serviceRequests", validatedData.serviceRequestId);
    await updateDoc(requestDocRef, {
      meetingUrl: eventResult.meetLink,
      googleEventId: eventResult.eventId,
      status: "confirmed",
      consultationTime: new Date(validatedData.startDateTime),
      updatedAt: serverTimestamp(),
    });

    // Create a record in 'googleMeetConsults' for history/logging
    const consultsCollection = collection(db, "googleMeetConsults");
    const newConsultDoc = await addDoc(consultsCollection, {
      serviceRequestId: validatedData.serviceRequestId,
      userId: validatedData.userId,
      userName: validatedData.userName,
      userEmail: validatedData.userEmail,
      providerId: "eQwXAu9jw7cL0YtMHA3WuQznKfg1", // The Admin/Provider UID
      providerName: "DigitalMen0 دعم",
      googleEventId: eventResult.eventId,
      meetLink: eventResult.meetLink,
      startTime: validatedData.startDateTime,
      endTime: validatedData.endDateTime,
      status: 'scheduled', // scheduled, completed, cancelled
      createdAt: serverTimestamp(),
    });

    console.log("Google Meet consultation scheduled successfully:", {
      meetLink: eventResult.meetLink,
      eventId: eventResult.eventId,
      consultId: newConsultDoc.id,
      serviceRequestId: validatedData.serviceRequestId
    });

    // Send consultation scheduled email
    try {
      const emailResult = await emailService.sendConsultationScheduled({
        name: validatedData.userName,
        meetLink: eventResult.meetLink || '',
        consultId: newConsultDoc.id,
        serviceRequestId: validatedData.serviceRequestId,
        consultationTime: validatedData.startDateTime,
        email: validatedData.userEmail,
      });

      if (emailResult.success) {
        console.log('Google Meet consultation email sent successfully:', emailResult.messageId);
      } else {
        console.warn('Consultation scheduled, but failed to send email:', emailResult.error);
      }
    } catch (emailError) {
      console.warn("Consultation scheduled, but failed to send email:", emailError);
      // Don't block the consultation scheduling if email fails
    }

    return {
      success: true,
      message: `تم جدولة استشارة Google Meet بنجاح.`,
      meetLink: eventResult.meetLink,
      eventId: eventResult.eventId,
      consultId: newConsultDoc.id,
    };
  } catch (error: any) {
    console.error("Error scheduling Google Meet consultation:", error);
    return {
      success: false,
      message: error.message || "حدث خطأ غير متوقع أثناء الجدولة.",
    };
  }
}

// Function to get Google Meet consultation history
export async function getGoogleMeetConsultationHistory(userId: string) {
  try {
    const consultsCollection = collection(db, "googleMeetConsults");
    const q = query(consultsCollection, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    
    const consultations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, consultations };
  } catch (error: any) {
    console.error("Error fetching Google Meet consultation history:", error);
    return { success: false, error: error.message };
  }
}

// Function to get available time slots for a date
export async function getAvailableTimeSlots(date: string) {
  try {
    const timeSlots = await googleCalendarService.getAvailableTimeSlots(date);
    return { success: true, timeSlots };
  } catch (error: any) {
    console.error("Error fetching available time slots:", error);
    return { success: false, error: error.message };
  }
}

// Function to get bookable days for a month
export async function getBookableDays(year: number, month: number) {
  try {
    const days = await googleCalendarService.getBookableDays(year, month);
    return { success: true, days };
  } catch (error: any) {
    console.error("Error fetching bookable days:", error);
    return { success: false, error: error.message };
  }
}

// Legacy function for backward compatibility - now redirects to Google Meet
export async function scheduleWebRtcConsultation(
    serviceRequestId: string, 
    userId: string, 
    userName: string
): Promise<ScheduleResult> {
  console.warn("scheduleWebRtcConsultation is deprecated. Use scheduleGoogleMeetConsultation instead.");
  
  try {
    // Get user email from service request
    const requestDocRef = doc(db, "serviceRequests", serviceRequestId);
    const requestDoc = await getDoc(requestDocRef);
    
    if (!requestDoc.exists()) {
      return { success: false, message: "طلب الخدمة غير موجود." };
    }

    const requestData = requestDoc.data();
    const userEmail = requestData.email || '';

    if (!userEmail) {
      return { success: false, message: "عنوان البريد الإلكتروني مطلوب." };
    }

    // Create a default appointment time (next available slot)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    
    const startDateTime = tomorrow.toISOString();
    const endDateTime = new Date(tomorrow.getTime() + 40 * 60000).toISOString(); // 40 minutes later

    return await scheduleGoogleMeetConsultation(
      serviceRequestId,
      userId,
      userName,
      userEmail,
      startDateTime,
      endDateTime,
      `Consultation with ${userName}`,
      `Digital marketing consultation for service request ${serviceRequestId}`
    );
  } catch (error: any) {
    console.error("Error in legacy scheduleWebRtcConsultation:", error);
    return {
      success: false,
      message: error.message || "حدث خطأ غير متوقع أثناء الجدولة.",
    };
  }
}
