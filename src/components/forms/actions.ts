
"use server";

import { z } from "zod";
import { db } from '@/lib/firebase'; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v2 as cloudinary } from 'cloudinary';
import { isToday } from "date-fns";
import { Resend } from 'resend';
import ConfirmationEmail from '@/components/emails/ConfirmationEmail';

const SERVICE_PROVIDER_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;


// --- Schema moved outside the action function ---
const selectedSlotSchema = z.object({
  date: z.string().min(1, "التاريخ مطلوب للموعد."), 
  time: z.string().min(1, "الوقت مطلوب للموعد."), 
});

const actionFormSchema = z.object({
  name: z.string().min(1, "الاسم الأول مطلوب."),
  surname: z.string().min(1, "اللقب مطلوب."),
  email: z.string().email("الرجاء إدخال عنوان بريد إلكتروني صالح."),
  phone: z.string().min(1, "رقم الهاتف مطلوب."),
  serviceType: z.enum(["coaching", "consultation"]),
  meetingType: z.enum(["online", "in-person"]),
  problemDescription: z
    .string()
    .min(1, "وصف المشكلة مطلوب.")
    .max(1000, "وصف المشكلة يجب ألا يتجاوز 1000 حرف."),
  selectedSlots: z.array(selectedSlotSchema).min(1, "الرجاء اختيار موعد واحد على الأقل."),
  paymentProof: z.object({
      base64: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
  }).optional(),
});
// --- End of moved schema ---

interface ActionResult {
  success: boolean;
  error?: string;
  requestId?: string;
}

export async function submitRequest(
  values: z.infer<typeof actionFormSchema>
): Promise<ActionResult> {
  
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Cloudinary is not configured. Please check environment variables.");
    return { success: false, error: "خدمة تحميل الملفات غير مهيأة بشكل صحيح." };
  }

  if (SERVICE_PROVIDER_UID === "REPLACE_WITH_YOUR_SERVICE_PROVIDER_UID") {
    console.error("Service provider UID is not configured.");
    return {
      success: false,
      error: "لا يمكن إرسال الطلب. معرف مقدم الخدمة غير مهيأ بشكل صحيح."
    };
  }
  
  try {
    const validatedData = actionFormSchema.parse(values);
    const { serviceType, selectedSlots, paymentProof, ...restOfData } = validatedData;
    
    // Server-side validation of business logic
    if (selectedSlots.some(slot => isToday(new Date(slot.date)))) {
      throw new Error("لا يمكن حجز أي جلسة في نفس اليوم.");
    }
    
    let paymentProofCloudinaryInfo: { cloudinaryUrl?: string; cloudinaryPublicId?: string; fileName?: string; fileType?: string; } | null = null;

    if (serviceType === 'consultation') {
        if (!paymentProof?.base64) {
            throw new Error("إثبات الدفع مطلوب لخدمة الاستشارة.");
        }
       
        if (selectedSlots.length !== 1) {
            throw new Error("يجب اختيار موعد واحد فقط للاستشارة.");
        }

        const uploadResult = await cloudinary.uploader.upload(paymentProof.base64, {
            folder: "digitalmen0/payment_proofs",
            resource_type: "image"
        });

         if (!uploadResult || !uploadResult.secure_url) {
           return { success: false, error: "فشل تحميل إثبات الدفع إلى Cloudinary." };
         }
         paymentProofCloudinaryInfo = {
           cloudinaryUrl: uploadResult.secure_url,
           cloudinaryPublicId: uploadResult.public_id,
           fileName: paymentProof.fileName,
           fileType: paymentProof.fileType,
         };

    } else if (serviceType === 'coaching') {
        if (selectedSlots.length > 4) {
            throw new Error("يمكنك اختيار 4 مواعيد كحد أقصى للتدريب.");
        }
        const dates = selectedSlots.map(slot => slot.date);
        const uniqueDates = new Set(dates);
        if (uniqueDates.size !== dates.length) {
            throw new Error("يجب أن تكون كل جلسة تدريب في يوم مختلف.");
        }
    }
    
    const userId = `user_anon_${Date.now()}`;
    const userName = `${restOfData.name} ${restOfData.surname}`;

    const dataToStore = {
      userId: userId,
      providerId: SERVICE_PROVIDER_UID, 
      ...restOfData,
      serviceType: serviceType,
      selectedSlots: selectedSlots,
      paymentProofInfo: paymentProofCloudinaryInfo, 
      status: "pending", 
      createdAt: serverTimestamp(),
      userEmail: restOfData.email, 
      userName: userName, 
      meetingUrl: null,
    };

    const docRef = await addDoc(collection(db, "serviceRequests"), dataToStore);

    // Send confirmation email
    if (resend) {
        try {
            await resend.emails.send({
                from: 'DigitalMen0 <onboarding@resend.dev>',
                to: [validatedData.email],
                subject: 'تم تأكيد استلام طلبك | Your Request Confirmation',
                react: ConfirmationEmail({
                    name: userName,
                    requestId: docRef.id.substring(0, 8).toUpperCase(),
                })
            });
        } catch (emailError) {
            console.warn("Request saved, but failed to send confirmation email:", emailError);
            // Don't block the user flow if email fails. Just log the issue.
        }
    } else {
        console.warn("RESEND_API_KEY not found. Skipping confirmation email.");
    }
    
    return { success: true, requestId: docRef.id };

  } catch (error: any) {
    console.error("CRITICAL ERROR in submitRequest server action:", error);
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `بيانات الإدخال غير صالحة: ${formattedErrors}` };
    }
    
    let errorMessage = "حدث خطأ غير متوقع أثناء معالجة طلبك.";
    if (typeof error.message === 'string' && error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
