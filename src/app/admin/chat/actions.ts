
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { z } from 'zod';

const ADMIN_UID_INTERNAL = "eQwXAu9jw7cL0YtMHA3WuQznKfg1"; // Internal constant for this file

export interface ChatSessionAdminListItem {
  chatId: string;
  clientUid: string;
  clientName: string;
  lastMessageText: string;
  lastMessageTimestamp: string; // ISO string
  lastMessageSenderId: string;
  isReadByAdmin?: boolean; // Future enhancement
}

interface FetchChatSessionsResult {
  success: boolean;
  sessions?: ChatSessionAdminListItem[];
  error?: string;
}

export async function fetchAdminChatSessions(adminUid: string): Promise<FetchChatSessionsResult> {
  if (adminUid !== ADMIN_UID_INTERNAL) {
    return { success: false, error: "وصول غير مصرح به إلى محادثات المدير." };
  }

  try {
    const chatSessionsColRef = collection(db, "chatSessions");
    // Query for sessions where the admin is a participant.
    // The orderBy clause on a different field requires a composite index.
    // We will remove it and sort the results in code to avoid the index requirement.
    const q = query(
      chatSessionsColRef,
      where("adminUid", "==", adminUid)
      // orderBy("lastMessageTimestamp", "desc") // This requires a composite index. Removed.
    );

    const querySnapshot = await getDocs(q);
    const sessions: ChatSessionAdminListItem[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let lastMessageTimestampStr = '';
      if (data.lastMessageTimestamp instanceof Timestamp) {
        lastMessageTimestampStr = data.lastMessageTimestamp.toDate().toISOString();
      } else if (typeof data.lastMessageTimestamp === 'string') {
        lastMessageTimestampStr = data.lastMessageTimestamp;
      } else if (data.lastMessageTimestamp) { // Fallback for other potential formats
        lastMessageTimestampStr = new Date(data.lastMessageTimestamp).toISOString();
      }
      
      // Determine client's details
      const clientUid = data.clientUid || data.participants?.find((pId: string) => pId !== adminUid) || "عميل غير معروف";
      
      let clientName = data.clientName || "عميل غير معروف";
      if (data.participantNames && clientUid !== "Unknown Client") {
         clientName = data.participantNames[clientUid] || "عميل";
      }

      sessions.push({
        chatId: docSnap.id,
        clientUid: clientUid,
        clientName: clientName,
        lastMessageText: data.lastMessageText || "",
        lastMessageTimestamp: lastMessageTimestampStr,
        lastMessageSenderId: data.lastMessageSenderId || "",
      });
    });
    
    // Sort the sessions manually in descending order of timestamp
    sessions.sort((a, b) => {
      const dateA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
      const dateB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
      return dateB - dateA;
    });

    return { success: true, sessions };

  } catch (error: any) {
    console.error("Error fetching admin chat sessions:", error);
    // Provide a more user-friendly error if it's the index error
    if (error.code === 'failed-precondition') {
      return {
        success: false,
        error: "فشل استعلام قاعدة البيانات. غالبًا ما يحدث هذا إذا كان فهرس قاعدة البيانات المطلوب مفقودًا. يرجى مراجعة سجلات الخادم للحصول على رابط لإنشاء الفهرس اللازم في وحدة تحكم Firebase الخاصة بك.",
      };
    }
    return {
      success: false,
      error: error.message || "حدث خطأ غير متوقع أثناء جلب جلسات المحادثة.",
    };
  }
}

// Note: The `sendMessage` action remains in `src/app/chat/actions.ts`
// but will be used by both client and admin chat pages.
// We might consider moving it to a more shared location if complexity grows,
// or have admin-specific send logic if needed.
