
"use client";

import { useState, useEffect, useTransition } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, getDay } from "date-fns";
import { arSA } from "date-fns/locale";
import { saveAvailability, getAvailability } from "./actions";
import { getWeeklyTemplate } from '@/app/admin/availability-template/actions';
import { CalendarDays, Clock, Save, Settings, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", 
  "17:00", "17:30"
];

export default function AdminAvailabilityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [availableSlotsForDate, setAvailableSlotsForDate] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isOverride, setIsOverride] = useState(false); // New state to track if the current view is an override

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/availability");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && selectedDate) {
      setIsLoadingSlots(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      startTransition(async () => {
        // First, try to get a specific override for the day
        const overrideResult = await getAvailability(user.uid, dateStr);
        if (overrideResult.success && overrideResult.slots && overrideResult.slots.length > 0) {
          setAvailableSlotsForDate(overrideResult.slots);
          setIsOverride(true);
        } else {
          // If no override, fall back to the weekly template
          const weeklyTemplateResult = await getWeeklyTemplate(user.uid);
          if (weeklyTemplateResult.success && weeklyTemplateResult.template) {
              const dayOfWeek = getDay(selectedDate); // Sunday = 0, Monday = 1, ...
              const slots = weeklyTemplateResult.template[String(dayOfWeek)] || [];
              setAvailableSlotsForDate(slots);
              setIsOverride(false);
          } else {
             toast({
                variant: "destructive",
                title: "خطأ في جلب المواعيد",
                description: weeklyTemplateResult.error || "لم نتمكن من جلب جدول المواعيد الأسبوعي.",
             });
             setAvailableSlotsForDate([]);
             setIsOverride(false);
          }
        }
        setIsLoadingSlots(false);
      });
    }
  }, [user, selectedDate, toast]);


  const handleSlotChange = (slot: string, checked: boolean) => {
    setAvailableSlotsForDate(prev => {
      const newSlots = checked ? [...prev, slot].sort() : prev.filter(s => s !== slot);
      setIsOverride(true); // Any change creates an override
      return newSlots;
    });
  };

  const handleSaveAvailability = async () => {
    if (!user || !selectedDate) {
      toast({ variant: "destructive", title: "خطأ", description: "المستخدم غير مسجل أو لم يتم تحديد تاريخ." });
      return;
    }
    setIsLoadingSlots(true); // Use same loading state for saving
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    startTransition(async () => {
      // This action now saves a daily override
      const result = await saveAvailability(user.uid, dateStr, availableSlotsForDate);
      if (result.success) {
        toast({
          title: "تم حفظ الاستثناء بنجاح",
          description: `تم تحديث المواعيد الخاصة بيوم ${format(selectedDate, "PPP", { locale: arSA })}.`,
        });
        setIsOverride(true); // After saving, it's definitely an override
      } else {
        toast({
          variant: "destructive",
          title: "خطأ في حفظ المواعيد",
          description: result.error || "لم نتمكن من حفظ المواعيد المتاحة.",
        });
      }
      setIsLoadingSlots(false);
    });
  };
  
  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold text-primary">استثناءات المواعيد اليومية</CardTitle>
          </div>
          <CardDescription className="text-lg text-foreground/80">
            هذه الصفحة لتحديد استثناءات لجدولك الأسبوعي الافتراضي. اختر تاريخًا لتجاوز المواعيد المتاحة لذلك اليوم فقط. لإدارة جدولك الأسبوعي المتكرر، استخدم صفحة <Button asChild variant="link" className="p-0 h-auto text-lg"><Link href="/admin/availability-template">الجدول الأسبوعي الافتراضي</Link></Button>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-8 items-start">
          <div className="flex flex-col items-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} // Disable past dates
              className="rounded-md border shadow-sm"
              dir="rtl"
            />
          </div>
          <div className="space-y-4">
            {selectedDate && (
              <h3 className="text-xl font-semibold text-center text-foreground">
                المواعيد ليوم: {format(selectedDate, "PPP", { locale: arSA })}
              </h3>
            )}
             {isOverride && selectedDate && (
                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
                  <AlertCircle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
                  <AlertTitle>ملاحظة: استثناء</AlertTitle>
                  <AlertDescription>
                   أنت تعرض حاليًا مواعيد مخصصة لهذا اليوم فقط. أي تغييرات ستحفظ كاستثناء للجدول الأسبوعي.
                  </AlertDescription>
                </Alert>
            )}
            {isLoadingSlots && <p className="text-center text-muted-foreground">جاري تحميل الأوقات...</p>}
            {!isLoadingSlots && selectedDate && (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-4 border rounded-md max-h-96 overflow-y-auto">
                  {TIME_SLOTS.map((slot) => (
                    <div key={slot} className="flex items-center space-x-2 rtl:space-x-reverse">
                      <Checkbox
                        id={`slot-${slot.replace(":", "")}`}
                        checked={availableSlotsForDate.includes(slot)}
                        onCheckedChange={(checked) => handleSlotChange(slot, !!checked)}
                      />
                      <Label htmlFor={`slot-${slot.replace(":", "")}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1">
                         <Clock className="h-4 w-4 text-muted-foreground" /> {slot}
                      </Label>
                    </div>
                  ))}
                </div>
                <Button onClick={handleSaveAvailability} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isPending}>
                  <Save className="ml-2 h-5 w-5 rtl:mr-2 rtl:ml-0" />
                  {isPending ? "جاري الحفظ..." : "حفظ المواعيد لهذا اليوم"}
                </Button>
              </>
            )}
            {!selectedDate && (
              <p className="text-center text-muted-foreground py-8">الرجاء اختيار تاريخ لعرض وتعديل الأوقات المتاحة.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
