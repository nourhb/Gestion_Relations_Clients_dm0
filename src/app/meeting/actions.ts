
"use server";

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { z } from "zod";

const scheduleSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  serviceRequestId: z.string(),
});

interface ScheduleResult {
  success: boolean;
  message: string;
  roomId?: string;
  consultId?: string;
}

export async function scheduleWebRtcConsultation(
    serviceRequestId: string, 
    userId: string, 
    userName: string
): Promise<ScheduleResult> {
  const validation = scheduleSchema.safeParse({ userId, userName, serviceRequestId });

  if (!validation.success) {
    return { success: false, message: "بيانات الجدولة المقدمة غير صالحة." };
  }
  
  const { serviceRequestId: validatedRequestId, userId: validatedUserId, userName: validatedUserName } = validation.data;

  try {
    // The roomId is now just the service request ID for simplicity.
    // The actual WebRTC session documents will be in a different collection.
    const roomId = validatedRequestId;
    
    // Update the original service request with the meeting ID
    const requestDocRef = doc(db, "serviceRequests", validatedRequestId);
    await updateDoc(requestDocRef, {
      meetingUrl: roomId, // Store the room ID here
      status: "confirmed",
    });

    // You can optionally still create a record in 'videoConsults' if you need it for history/logging
    const consultsCollection = collection(db, "videoConsults");
    const newConsultDoc = await addDoc(consultsCollection, {
      roomId: roomId,
      serviceRequestId: validatedRequestId,
      userId: validatedUserId,
      userName: validatedUserName,
      providerId: "eQwXAu9jw7cL0YtMHA3WuQznKfg1", // The Admin/Provider UID
      providerName: "DigitalMen0 دعم",
      status: 'scheduled', // scheduled, completed, cancelled
      createdAt: serverTimestamp(),
      consultationTime: serverTimestamp(), // In a real scenario this would be a future date from the request
    });


    return {
      success: true,
      message: `تم جدولة استشارة WebRTC بنجاح.`,
      roomId: roomId,
      consultId: newConsultDoc.id,
    };
  } catch (error: any) {
    console.error("Error scheduling WebRTC consultation:", error);
    return {
      success: false,
      message: error.message || "حدث خطأ غير متوقع أثناء الجدولة.",
    };
  }
}
