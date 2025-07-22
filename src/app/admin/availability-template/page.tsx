
"use client";

import { useState, useEffect, useTransition } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { saveWeeklyTemplate, getWeeklyTemplate } from "./actions";
import { Clock, Save, Loader2, Settings } from "lucide-react";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", 
  "17:00", "17:30"
];

const DAYS_OF_WEEK = [
  { name: "الأحد", key: "0" },
  { name: "الإثنين", key: "1" },
  { name: "الثلاثاء", key: "2" },
  { name: "الأربعاء", key: "3" },
  { name: "الخميس", key: "4" },
  { name: "الجمعة", key: "5" },
  { name: "السبت", key: "6" },
];

export default function AdminAvailabilityTemplatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // State to hold the template: { "0": ["09:00"], "1": ["10:00", "10:30"], ... }
  const [template, setTemplate] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/availability-template");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      startTransition(async () => {
        const result = await getWeeklyTemplate(user.uid);
        if (result.success && result.template) {
          setTemplate(result.template);
        } else if (!result.success) {
          toast({
            variant: "destructive",
            title: "خطأ في جلب الجدول",
            description: result.error || "لم نتمكن من جلب جدول المواعيد الأسبوعي.",
          });
          setTemplate({});
        }
        setIsLoading(false);
      });
    }
  }, [user, toast]);

  const handleSlotChange = (dayKey: string, slot: string, checked: boolean) => {
    setTemplate(prev => {
      const daySlots = prev[dayKey] || [];
      const newSlots = checked ? [...daySlots, slot].sort() : daySlots.filter(s => s !== slot);
      return { ...prev, [dayKey]: newSlots };
    });
  };

  const handleSaveTemplate = () => {
    if (!user) {
      toast({ variant: "destructive", title: "خطأ", description: "المستخدم غير مسجل." });
      return;
    }
    startTransition(async () => {
      const result = await saveWeeklyTemplate(user.uid, template);
      if (result.success) {
        toast({
          title: "تم حفظ الجدول بنجاح",
          description: "تم تحديث جدول مواعيدك الأسبوعي الافتراضي.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "خطأ في حفظ الجدول",
          description: result.error || "لم نتمكن من حفظ جدول المواعيد.",
        });
      }
    });
  };

  if (authLoading || !user || isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">جاري تحميل جدولك الأسبوعي...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-6xl mx-auto shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold text-primary">الجدول الأسبوعي الافتراضي</CardTitle>
          </div>
          <CardDescription className="text-lg text-foreground/80">
            حدد ساعات العمل القياسية الخاصة بك لكل يوم من أيام الأسبوع. سيتم استخدام هذا الجدول تلقائيًا ما لم تقم بتجاوزه في صفحة الاستثناءات اليومية.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            {DAYS_OF_WEEK.map(day => (
                <div key={day.key} className="border-b pb-6 last:border-b-0 last:pb-0">
                    <h3 className="text-xl font-semibold mb-4">{day.name}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 p-4 border rounded-md">
                        {TIME_SLOTS.map((slot) => (
                            <div key={slot} className="flex items-center space-x-2 rtl:space-x-reverse">
                            <Checkbox
                                id={`slot-${day.key}-${slot.replace(":", "")}`}
                                checked={template[day.key]?.includes(slot) || false}
                                onCheckedChange={(checked) => handleSlotChange(day.key, slot, !!checked)}
                            />
                            <Label htmlFor={`slot-${day.key}-${slot.replace(":", "")}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" /> {slot}
                            </Label>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
             <Button onClick={handleSaveTemplate} className="w-full mt-8 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isPending}>
                <Save className="ml-2 h-5 w-5 rtl:mr-2 rtl:ml-0" />
                {isPending ? "جاري الحفظ..." : "حفظ الجدول الأسبوعي"}
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
