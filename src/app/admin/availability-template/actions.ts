
"use server";

import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { z } from "zod";

// Schema for validating the weekly template data
// Keys are day numbers as strings ("0" for Sunday, "1" for Monday, etc.)
const WeeklyTemplateSchema = z.record(
  z.string().regex(/^[0-6]$/), // Key is a digit from 0 to 6
  z.array(z.string().regex(/^\d{2}:\d{2}$/)) // Value is an array of times
);

interface ActionResult {
  success: boolean;
  error?: string;
}

interface GetTemplateResult extends ActionResult {
    template?: Record<string, string[]>;
}

/**
 * Saves the weekly availability template for a specific user to Firestore.
 * @param userId - The UID of the user whose template is being set.
 * @param template - An object where keys are day numbers (0-6) and values are arrays of time slots.
 */
export async function saveWeeklyTemplate(
  userId: string,
  template: Record<string, string[]>
): Promise<ActionResult> {
  if (!userId) {
      return { success: false, error: "معرف المستخدم مطلوب." };
  }

  try {
    const validation = WeeklyTemplateSchema.safeParse(template);
    if (!validation.success) {
      const formattedErrors = Object.entries(validation.error.flatten().fieldErrors)
        .map(([path, messages]) => `${path}: ${messages?.join(', ')}`)
        .join('; ');
      return { success: false, error: `بيانات الجدول غير صالحة: ${formattedErrors}` };
    }

    const templateDocRef = doc(db, "availabilityTemplates", userId);
    
    await setDoc(templateDocRef, {
      template: validation.data,
      updatedAt: serverTimestamp(),
    });

    console.log(`Weekly template saved for user ${userId}:`, validation.data);
    return { success: true };

  } catch (error: any) {
    console.error("Error saving weekly template:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ غير متوقع أثناء حفظ الجدول الأسبوعي.",
    };
  }
}

/**
 * Retrieves the weekly availability template for a specific user from Firestore.
 * @param userId - The UID of the user.
 */
export async function getWeeklyTemplate(userId: string): Promise<GetTemplateResult> {
  if (!userId) {
    return { success: false, error: "معرف المستخدم مطلوب." };
  }

  try {
    const templateDocRef = doc(db, "availabilityTemplates", userId);
    const docSnap = await getDoc(templateDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const template = data.template as Record<string, string[]> || {};
      console.log(`Weekly template fetched for user ${userId}`);
      return { success: true, template: template };
    } else {
      console.log(`No weekly template document found for user ${userId}. Returning empty template.`);
      return { success: true, template: {} };
    }
  } catch (error: any) {
    console.error("Error fetching weekly template:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ غير متوقع أثناء جلب الجدول الأسبوعي.",
    };
  }
}
