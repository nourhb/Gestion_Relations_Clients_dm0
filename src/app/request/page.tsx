
"use client";
export const dynamic = "force-dynamic";

import React, { Suspense } from "react";
import SubmissionForm from '@/components/forms/SubmissionForm';
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

function RequestPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const serviceTypeParam = searchParams.get('service') as "coaching" | "consultation" | null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <section className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3 text-primary">طلب خدمة</h1>
        <p className="text-base text-foreground/80 max-w-xl mx-auto">
          الرجاء ملء النموذج التالي لطلب خدمة استشارة أو تدريب. سنراجع طلبك ونتواصل معك لتأكيد المواعيد.
        </p>
      </section>
      <section className="max-w-2xl mx-auto">
        <SubmissionForm key={`${serviceTypeParam || 'default'}`} initialServiceType={serviceTypeParam || undefined} onSuccess={(requestId) => router.push(`/request/confirmation/${requestId}`)} />
      </section>
    </div>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RequestPageContent />
    </Suspense>
  );
}
