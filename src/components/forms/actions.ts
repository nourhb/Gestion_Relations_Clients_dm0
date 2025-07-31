
"use server";

import { z } from "zod";
import { db } from '@/lib/firebase'; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v2 as cloudinary } from 'cloudinary';
import { isToday } from "date-fns";
import { emailService } from '@/lib/email';

const SERVICE_PROVIDER_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
    const { serviceType, meetingType, selectedSlots, paymentProof, ...restOfData } = validatedData;
    
    // Server-side validation of business logic
    if (selectedSlots.some(slot => isToday(new Date(slot.date)))) {
      throw new Error("لا يمكن حجز أي جلسة في نفس اليوم.");
    }
    
    let paymentProofCloudinaryInfo: { cloudinaryUrl?: string; cloudinaryPublicId?: string; fileName?: string; fileType?: string; } | null = null;
    
    // Handle payment proof upload if provided
    if (paymentProof?.base64 && paymentProof?.fileName && paymentProof?.fileType) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(paymentProof.base64, {
          resource_type: 'auto',
          folder: 'payment-proofs',
          public_id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        
        paymentProofCloudinaryInfo = {
          cloudinaryUrl: uploadResponse.secure_url,
          cloudinaryPublicId: uploadResponse.public_id,
          fileName: paymentProof.fileName,
          fileType: paymentProof.fileType,
        };
        
        console.log("Payment proof uploaded successfully:", paymentProofCloudinaryInfo);
      } catch (uploadError) {
        console.error("Failed to upload payment proof:", uploadError);
        // Don't fail the entire request if payment proof upload fails
        // Just log the error and continue without payment proof
      }
    }
    
    const userName = `${validatedData.name} ${validatedData.surname}`;
    const createdAt = new Date().toISOString();
    
    // Prepare data for Firestore
    const dataToStore = {
      ...restOfData,
      userName,
      serviceType,
      meetingType,
      selectedSlots,
      paymentProof: paymentProofCloudinaryInfo,
      status: "pending", // pending, confirmed, completed, cancelled
      serviceProviderUid: SERVICE_PROVIDER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "serviceRequests"), dataToStore);

    // Send confirmation email using Nodemailer
    try {
      const emailResult = await emailService.sendRequestConfirmation({
        name: userName,
        requestId: docRef.id.substring(0, 8).toUpperCase(),
        serviceType,
        meetingType,
        problemDescription: validatedData.problemDescription,
        selectedSlots,
        email: validatedData.email,
        phone: validatedData.phone,
        createdAt,
      });

      if (emailResult.success) {
        console.log('Request confirmation email sent successfully:', emailResult.messageId);
      } else {
        console.warn('Request saved, but failed to send confirmation email:', emailResult.error);
        // Don't block the user flow if email fails. Just log the issue.
      }
    } catch (emailError) {
      console.warn("Request saved, but failed to send confirmation email:", emailError);
      // Don't block the user flow if email fails. Just log the issue.
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
