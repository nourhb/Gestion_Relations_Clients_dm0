
"use server";

import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { z } from "zod";
import { getWeeklyTemplate } from '@/app/admin/availability-template/actions'; // Import the new template action
import { getDay } from 'date-fns';

// Schema for validating availability data
const AvailabilitySchema = z.object({
  userId: z.string().min(1, "معرف المستخدم مطلوب."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يجب أن يكون التاريخ بصيغة YYYY-MM-DD."),
  slots: z.array(z.string().regex(/^\d{2}:\d{2}$/, "يجب أن يكون كل موعد بصيغة HH:MM.")),
});

interface ActionResult {
  success: boolean;
  error?: string;
  slots?: string[]; // For getAvailability
  finalSlots?: string[]; // For getCombinedAvailability
}

/**
 * Saves the available time slots for a specific user and date to Firestore.
 * This is now used for daily overrides.
 * @param userId - The UID of the user whose availability is being set.
 * @param date - The date in "YYYY-MM-DD" format.
 * @param slots - An array of time slots (e.g., ["09:00", "10:30"]).
 */
export async function saveAvailability(
  userId: string,
  date: string,
  slots: string[]
): Promise<ActionResult> {
  try {
    const validation = AvailabilitySchema.safeParse({ userId, date, slots });
    if (!validation.success) {
      console.error("Validation errors:", validation.error.flatten().fieldErrors);
      const formattedErrors = Object.entries(validation.error.flatten().fieldErrors)
        .map(([path, messages]) => `${path}: ${messages?.join(', ')}`)
        .join('; ');
      return { success: false, error: `بيانات غير صالحة: ${formattedErrors}` };
    }

    const availabilityDocRef = doc(db, "availabilities", userId, "dates", date);
    
    await setDoc(availabilityDocRef, {
      slots: validation.data.slots,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`Availability override saved for user ${userId} on ${date}:`, validation.data.slots);
    return { success: true };

  } catch (error: any)    {
    console.error("Error saving availability override:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ غير متوقع أثناء حفظ المواعيد.",
    };
  }
}

/**
 * Retrieves the available time slots for a specific user and date from Firestore.
 * This fetches a daily override if it exists.
 * @param userId - The UID of the user.
 * @param date - The date in "YYYY-MM-DD" format.
 */
export async function getAvailability(
  userId: string,
  date: string
): Promise<ActionResult> {
  if (!userId || !date) {
    return { success: false, error: "معرف المستخدم والتاريخ مطلوبان." };
  }

  try {
    const availabilityDocRef = doc(db, "availabilities", userId, "dates", date);
    const docSnap = await getDoc(availabilityDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const slots = data.slots as string[] || [];
      console.log(`Availability override fetched for user ${userId} on ${date}:`, slots);
      return { success: true, slots: slots };
    } else {
      console.log(`No availability override found for user ${userId} on ${date}.`);
      return { success: true, slots: [] }; 
    }
  } catch (error: any) {
    console.error("Error fetching availability override:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ غير متوقع أثناء جلب المواعيد.",
    };
  }
}


/**
 * Retrieves the truly available time slots for a provider on a specific date.
 * It first checks for a specific daily override. If none exists, it uses the weekly template.
 * Then, it removes any slots already booked in serviceRequests.
 * @param providerId - The UID of the service provider.
 * @param date - The date in "YYYY-MM-DD" format.
 */
export async function getCombinedAvailability(
  providerId: string,
  date: string // YYYY-MM-DD
): Promise<ActionResult> {
  if (!providerId || !date) {
    return { success: false, error: "معرف مقدم الخدمة والتاريخ مطلوبان." };
  }
  if (providerId === "REPLACE_WITH_YOUR_SERVICE_PROVIDER_UID") {
    console.warn("getCombinedAvailability called with placeholder SERVICE_PROVIDER_UID. No slots will be found if this is not replaced.");
     return { success: false, error: "معرف مقدم الخدمة غير مهيأ.", finalSlots: [] };
  }

  try {
    let generalSlots: string[] = [];

    // 1. Get daily override availability first
    const dailyOverrideResult = await getAvailability(providerId, date);

    if (dailyOverrideResult.success && dailyOverrideResult.slots && dailyOverrideResult.slots.length > 0) {
        console.log(`Using daily override for ${date}`);
        generalSlots = dailyOverrideResult.slots;
    } else {
        // 2. If no override, get the weekly template and determine slots for the day of the week
        console.log(`No daily override for ${date}, checking weekly template.`);
        const weeklyTemplateResult = await getWeeklyTemplate(providerId);
        if (weeklyTemplateResult.success && weeklyTemplateResult.template) {
            const dayOfWeek = getDay(new Date(date)); // Sunday = 0, Monday = 1, ...
            const dayKey = String(dayOfWeek);
            generalSlots = weeklyTemplateResult.template[dayKey] || [];
        } else {
            console.warn(`Could not fetch weekly template for provider ${providerId}: ${weeklyTemplateResult.error}`);
        }
    }
    
    if (generalSlots.length === 0) {
        console.log(`No general availability defined for provider ${providerId} on ${date}.`);
        return { success: true, finalSlots: [] }; // No general availability means no slots
    }

    // 3. Get booked slots for the provider on that specific date
    const bookedTimes = new Set<string>();
    const requestsCollectionRef = collection(db, "serviceRequests");
    const q = query(requestsCollectionRef, where("providerId", "==", providerId));
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
      const requestData = docSnap.data();
      if (requestData.status === 'cancelled') return; // Only block non-cancelled
      if (requestData.selectedSlots && Array.isArray(requestData.selectedSlots)) {
        requestData.selectedSlots.forEach((slot: any) => { 
          if (typeof slot === 'object' && slot !== null && typeof slot.date === 'string' && typeof slot.time === 'string') {
            if (slot.date === date) { 
              bookedTimes.add(slot.time);
            }
          }
        });
      }
    });
    console.log(`Booked times for provider ${providerId} on ${date}:`, Array.from(bookedTimes));

    // 4. Calculate final available slots
    const finalAvailableSlots = generalSlots.filter(slotTime => !bookedTimes.has(slotTime));
    console.log(`Final available slots for provider ${providerId} on ${date}:`, finalAvailableSlots);
    
    return { success: true, finalSlots: finalAvailableSlots };

  } catch (error: any) {
    console.error("Error fetching combined availability:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ غير متوقع أثناء جلب المواعيد المجمعة.",
      finalSlots: [], 
    };
  }
}
