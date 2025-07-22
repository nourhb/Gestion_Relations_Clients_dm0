
"use client";

import LoginForm from "@/components/auth/LoginForm";
import { Suspense } from "react";

function LoginPageContent() {
  return (
    <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[calc(100vh-8rem)]">
      <LoginForm isAdminLogin={true} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
