
"use server";

import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { z } from "zod";

const ADMIN_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1"; 
const ADMIN_DISPLAY_NAME = "DigitalMen0 دعم";

interface SendMessageResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

const getChatId = (uid1: string, uid2: string): string => {
  const ids = [uid1, uid2].sort();
  return ids.join("_");
};

// Updated schema to make text optional if imageUrl is present, and add senderName
const sendMessageSchema = z.object({
  text: z.string().max(1000, "الرسالة طويلة جدًا.").optional(),
  senderId: z.string().min(1, "معرف المرسل مطلوب."),
  receiverId: z.string().min(1, "معرف المستقبل مطلوب."),
  senderName: z.string().min(1, "اسم المرسل مطلوب."),
  imageUrl: z.string().url("رابط صورة غير صالح.").optional(),
}).refine(data => data.text || data.imageUrl, {
  message: "يجب أن تحتوي الرسالة على نص أو صورة.",
  path: ["text"], 
});


export async function sendMessage(
  senderId: string,
  receiverId: string,
  senderName: string, // Added senderName
  text?: string | undefined,
  imageUrl?: string
): Promise<SendMessageResult> {

  const validation = sendMessageSchema.safeParse({ senderId, receiverId, senderName, text: text || undefined, imageUrl });
  if (!validation.success) {
    const formattedErrors = Object.entries(validation.error.flatten().fieldErrors)
      .map(([path, messages]) => `${path}: ${messages?.join(', ')}`)
      .join('; ');
    return { success: false, error: `بيانات الرسالة غير صالحة: ${formattedErrors}` };
  }
  
  const { 
    senderId: validatedSenderId, 
    receiverId: validatedReceiverId, 
    senderName: validatedSenderName,
    text: validatedText, 
    imageUrl: validatedImageUrl 
  } = validation.data;

  const chatId = getChatId(validatedSenderId, validatedReceiverId);
  const chatSessionDocRef = doc(db, "chatSessions", chatId);

  try {
    // Add message to messages subcollection
    const messagesColRef = collection(db, "chats", chatId, "messages");
    const messagePayload: any = {
      senderId: validatedSenderId,
      receiverId: validatedReceiverId,
      senderName: validatedSenderName, 
      timestamp: serverTimestamp(),
    };
    if (validatedText) messagePayload.text = validatedText;
    if (validatedImageUrl) messagePayload.imageUrl = validatedImageUrl;
    
    const messageDocRef = await addDoc(messagesColRef, messagePayload);

    // Determine client details for session update
    const isSenderAdmin = validatedSenderId === ADMIN_UID;
    const clientUid = isSenderAdmin ? validatedReceiverId : validatedSenderId;
    
    // Get the client name. If the admin is sending, the client name should already exist in the session.
    // If the client is sending, they provide their name.
    const sessionSnap = await getDoc(chatSessionDocRef);
    const clientName = isSenderAdmin 
      ? sessionSnap.data()?.clientName || "زائر"
      : validatedSenderName;

    const participantsArray = [clientUid, ADMIN_UID].sort(); 
    const participantNamesMap = {
      [clientUid]: clientName,
      [ADMIN_UID]: ADMIN_DISPLAY_NAME,
    };
    
    const lastMessageSummary = validatedImageUrl ? (validatedText ? `${validatedText} (صورة)` : "صورة") : validatedText || "";

    // Update the session document
    await setDoc(chatSessionDocRef, {
      participants: participantsArray, 
      participantUids: { 
          uid1: participantsArray[0],
          uid2: participantsArray[1]
      },
      participantNames: participantNamesMap,
      lastMessageText: lastMessageSummary,
      lastMessageTimestamp: serverTimestamp(),
      lastMessageSenderId: validatedSenderId,
      clientUid: clientUid, 
      clientName: clientName, 
      adminUid: ADMIN_UID, 
      adminName: ADMIN_DISPLAY_NAME,
    }, { merge: true });

    return { success: true, messageId: messageDocRef.id };
  } catch (error: any) {
    console.error("Error sending message:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ غير متوقع أثناء إرسال الرسالة.",
    };
  }
}
