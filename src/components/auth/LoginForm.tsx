
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "الرجاء إدخال عنوان بريد إلكتروني صالح." }),
  password: z.string().min(1, { message: "الرجاء إدخال كلمة المرور." }),
});

export type LoginFormValues = z.infer<typeof formSchema>;

interface LoginFormProps {
    isAdminLogin?: boolean;
}

const ADMIN_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1";

export default function LoginForm({ isAdminLogin = false }: LoginFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    if (!auth) {
        toast({ variant: "destructive", title: "خطأ", description: "خدمة المصادقة غير مهيأة." });
        return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      if (isAdminLogin && userCredential.user.uid !== ADMIN_UID) {
        await auth.signOut();
        toast({
            variant: "destructive",
            title: "فشل تسجيل الدخول",
            description: "هذا الحساب لا يملك صلاحيات المدير.",
        });
        return;
      }

      toast({
        title: "تم تسجيل الدخول بنجاح!",
        description: "مرحباً بعودتك.",
      });
      
      const redirectUrl = searchParams.get('redirect') || (isAdminLogin ? "/admin/requests" : "/profile");
      router.push(redirectUrl);

    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "فشل تسجيل الدخول. يرجى التحقق من بريدك الإلكتروني وكلمة المرور.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "صيغة البريد الإلكتروني غير صالحة.";
      }
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الدخول",
        description: errorMessage,
      });
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold text-primary">{isAdminLogin ? "دخول المدير" : "تسجيل الدخول"}</CardTitle>
        <CardDescription className="text-md text-foreground/80 mt-2">
          {isAdminLogin ? "الرجاء إدخال بيانات اعتماد المدير." : "أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى حسابك."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isFirebaseConfigured ? (
           <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>خطأ في التهيئة</AlertTitle>
            <AlertDescription>
                خدمة Firebase غير مهيأة. الرجاء إضافة متغيرات البيئة الصحيحة وإعادة تشغيل الخادم.
            </AlertDescription>
           </Alert>
        ) : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                        <Input type="email" placeholder="example@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
                </Button>
            </form>
            </Form>
        )}
      </CardContent>
    </Card>
  );
}
