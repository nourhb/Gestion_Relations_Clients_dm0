"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ConfirmationPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const docRef = doc(db, "serviceRequests", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
          setError("لم يتم العثور على تفاصيل الطلب.");
        }
      } catch (e) {
        setError("حدث خطأ أثناء جلب تفاصيل الطلب.");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;
  if (!data) return null;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto bg-card p-8 rounded shadow">
        <h1 className="text-3xl font-bold mb-4 text-primary">تم استلام طلبك بنجاح</h1>
        <p className="mb-6">شكراً لك. هذه تفاصيل طلبك رقم: <span className="font-mono bg-muted px-2 py-1 rounded">{id.substring(0,8).toUpperCase()}</span></p>
        <div className="space-y-3 text-right">
          <div><span className="font-semibold">الاسم:</span> {data.name} {data.surname}</div>
          <div><span className="font-semibold">البريد الإلكتروني:</span> {data.email}</div>
          <div><span className="font-semibold">رقم الهاتف:</span> {data.phone}</div>
          <div><span className="font-semibold">نوع الخدمة:</span> {data.serviceType === 'consultation' ? 'استشارة' : 'تدريب'}</div>
          <div><span className="font-semibold">طريقة الجلسة:</span> {data.meetingType === 'online' ? 'أونلاين' : 'حضوري'}</div>
          <div><span className="font-semibold">وصف المشكلة:</span> {data.problemDescription}</div>
          <div><span className="font-semibold">المواعيد المختارة:</span>
            <ul className="list-disc pr-6">
              {data.selectedSlots && data.selectedSlots.map((slot: any, idx: number) => (
                <li key={idx}>{slot.date} - {slot.time}</li>
              ))}
            </ul>
          </div>
          {data.paymentProofInfo && data.paymentProofInfo.cloudinaryUrl && (
            <div>
              <span className="font-semibold">إثبات الدفع:</span><br />
              <a href={data.paymentProofInfo.cloudinaryUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">عرض الملف</a>
              {data.paymentProofInfo.fileType && data.paymentProofInfo.fileType.startsWith('image/') && (
                <div className="mt-2">
                  <img src={data.paymentProofInfo.cloudinaryUrl} alt="إثبات الدفع" style={{maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '1px solid #eee'}} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 