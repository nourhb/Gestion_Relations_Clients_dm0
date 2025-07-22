
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React, { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { CalendarIcon, Loader2, MapPin } from "lucide-react";
import { format, isToday } from "date-fns";
import { arSA } from "date-fns/locale";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getCombinedAvailability } from "@/app/admin/availability/actions";
import { submitRequest } from "./actions";

// --- Schema and constants moved outside the component ---
const SERVICE_PROVIDER_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1";
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  name: z.string().min(1, { message: "الاسم الأول مطلوب." }),
  surname: z.string().min(1, { message: "اللقب مطلوب." }),
  email: z.string().email({ message: "الرجاء إدخال عنوان بريد إلكتروني صالح." }),
  phone: z.string().min(1, { message: "رقم الهاتف مطلوب." }),
  serviceType: z.enum(["coaching", "consultation"], {
    errorMap: () => ({ message: "الرجاء اختيار نوع الخدمة." }),
  }),
  meetingType: z.enum(["online", "in-person"], {
    errorMap: () => ({ message: "الرجاء اختيار طريقة الجلسة." }),
  }),
  problemDescription: z
    .string()
    .min(1, { message: "وصف المشكلة مطلوب." })
    .max(1000, { message: "وصف المشكلة يجب ألا يتجاوز 1000 حرف." }),
  selectedSlots: z.array(z.object({
    date: z.string(),
    time: z.string(),
  })).min(1, { message: "الرجاء اختيار موعد واحد على الأقل." }),
  paymentProof: z.any().optional(),
}).superRefine((data, ctx) => {
    if (data.selectedSlots.some(slot => isToday(new Date(slot.date)))) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "لا يمكن حجز أي جلسة في نفس اليوم.",
            path: ["selectedSlots"],
        });
    }
    if (data.serviceType === "consultation") {
        if (data.selectedSlots.length !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "يجب اختيار موعد واحد فقط للاستشارة.",
                path: ["selectedSlots"],
            });
        }
        if (!data.paymentProof || data.paymentProof.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "إثبات الدفع مطلوب لخدمة الاستشارة.",
                path: ["paymentProof"],
            });
        }
    } else if (data.serviceType === "coaching") {
        if (data.selectedSlots.length > 4) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "يمكنك اختيار 4 مواعيد كحد أقصى للتدريب.",
                path: ["selectedSlots"],
            });
        }
        const dates = data.selectedSlots.map(slot => slot.date);
        const uniqueDates = new Set(dates);
        if (uniqueDates.size !== dates.length) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "يجب أن تكون كل جلسة تدريب في يوم مختلف.",
                path: ["selectedSlots"],
            });
        }
    }
});

export type SubmissionFormValues = z.infer<typeof formSchema>;


const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});
// --- End of moved definitions ---

interface SubmissionFormProps {
  initialServiceType?: "coaching" | "consultation";
}

export default function SubmissionForm({ initialServiceType }: SubmissionFormProps) {
  const { toast } = useToast();
  const [isTransitionPending, startTransition] = useTransition();

  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const defaultValues = useMemo(() => ({
      name: "",
      surname: "",
      email: "",
      phone: "",
      serviceType: initialServiceType || "coaching",
      meetingType: "online" as "online" | "in-person",
      problemDescription: "",
      selectedSlots: [],
      paymentProof: undefined,
  }), [initialServiceType]);

  const form = useForm<SubmissionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
    mode: "onChange",
  });
  
  const watchedServiceType = form.watch("serviceType");
  const watchedSlots = form.watch("selectedSlots");
  const watchedMeetingType = form.watch("meetingType");


  const fetchAvailabilityForMonth = useCallback(async (month: Date) => {
    setIsLoadingAvailability(true);
    setAvailabilityError(null);
    try {
      const daysInMonth = Array.from(
        { length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() },
        (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
      );
      
      const availabilityPromises = daysInMonth.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        return getCombinedAvailability(SERVICE_PROVIDER_UID, dateStr);
      });
      
      const results = await Promise.all(availabilityPromises);

      const newAvailability: Record<string, string[]> = {};
      results.forEach((result, index) => {
        const dateStr = format(daysInMonth[index], "yyyy-MM-dd");
        if (result.success && result.finalSlots && result.finalSlots.length > 0) {
            newAvailability[dateStr] = result.finalSlots.sort();
        } else if (!result.success) {
          console.warn(`Could not fetch availability for ${dateStr}: ${result.error}`);
        }
      });
      
      setAvailability(prev => ({ ...prev, ...newAvailability }));
    } catch (error: any) {
      console.error("Error fetching monthly availability:", error);
      setAvailabilityError("حدث خطأ أثناء جلب جدول المواعيد.");
    } finally {
      setIsLoadingAvailability(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailabilityForMonth(currentMonth);
  }, [currentMonth, fetchAvailabilityForMonth]);
  
  const handleSlotToggle = (date: string, time: string) => {
    const newSlot = { date, time };
    const currentSlots = form.getValues("selectedSlots") || [];
    const serviceType = form.getValues("serviceType");
    let newSlots;

    const isSlotSelected = currentSlots.some(slot => slot.date === date && slot.time === time);

    if (isSlotSelected) {
      newSlots = currentSlots.filter(slot => !(slot.date === date && slot.time === time));
    } else {
      if (serviceType === "consultation") {
        newSlots = [newSlot];
      } else { // Coaching
        const hasDate = currentSlots.some(slot => slot.date === date);
        if (hasDate) {
             toast({
                variant: "destructive",
                title: "قاعدة غير مسموح بها",
                description: "لا يمكنك اختيار أكثر من جلسة تدريب واحدة في نفس اليوم.",
            });
            newSlots = currentSlots;
        } else if (currentSlots.length < 4) {
          newSlots = [...currentSlots, newSlot];
        } else {
          toast({
            variant: "destructive",
            title: "تم الوصول للحد الأقصى",
            description: "يمكنك اختيار 4 مواعيد كحد أقصى للتدريب.",
          });
          newSlots = currentSlots;
        }
      }
    }
    form.setValue("selectedSlots", newSlots, { shouldValidate: true });
    if(serviceType === 'consultation' && newSlots.length > 0) {
        setSelectedDay(undefined);
    }
  };

  async function onSubmit(values: SubmissionFormValues) {
    startTransition(async () => {
        const file = values.paymentProof?.[0];
        let paymentProofPayload: { base64?: string; fileName?: string; fileType?: string; } = {};

        // Re-validating payment proof on submit, just in case.
        if (values.serviceType === "consultation") {
            if (!file) {
                form.setError("paymentProof", { type: "manual", message: "إثبات الدفع مطلوب لخدمة الاستشارة." });
                return;
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                form.setError("paymentProof", { type: "manual", message: `الحد الأقصى لحجم الملف هو ${MAX_FILE_SIZE_MB} ميجا بايت.` });
                return;
            }
            if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                form.setError("paymentProof", { type: "manual", message: "صيغ الملفات المقبولة هي: .jpg, .jpeg, .png, .webp" });
                return;
            }
            
            try {
                paymentProofPayload = {
                    base64: await toBase64(file),
                    fileName: file.name,
                    fileType: file.type,
                };
            } catch (error) {
                toast({ variant: "destructive", title: "خطأ في قراءة الملف", description: "لم نتمكن من معالجة الملف الذي تم تحميله." });
                return;
            }
        }
        
        const dataToSend = { ...values, paymentProof: paymentProofPayload };

        const result = await submitRequest(dataToSend);

        if (result.success && result.requestId) {
          toast({
            title: "تم إرسال طلبك بنجاح!",
            description: `شكراً لك. سنتواصل معك قريباً بخصوص طلبك رقم: ${result.requestId.substring(0, 8).toUpperCase()}`,
          });
          form.reset(defaultValues);
          setSelectedFileName("");
          setSelectedDay(undefined);
        } else {
          toast({
            variant: "destructive",
            title: "فشل إرسال الطلب",
            description: result.error || "حدث خطأ غير متوقع. حاول مرة أخرى.",
          });
        }
    });
  }
  
  const paymentProofIsRequiredForSelectedType = watchedServiceType === "consultation";
  const fileRef = form.register("paymentProof");

  return (
    <Form {...form}>
      <form key={watchedServiceType} onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4 md:p-6 border rounded-lg shadow-sm bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>الاسم الأول<span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="مثال: أحمد" {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField control={form.control} name="surname" render={({ field }) => (
              <FormItem><FormLabel>اللقب<span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="مثال: المحمدي" {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>البريد الإلكتروني<span className="text-destructive">*</span></FormLabel><FormControl><Input type="email" placeholder="example@email.com" {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
          <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>رقم الهاتف<span className="text-destructive">*</span></FormLabel><FormControl><Input type="tel" placeholder="+216 XX XXX XXX" {...field} /></FormControl><FormMessage /></FormItem>
            )}
          />
        </div>

        <FormField control={form.control} name="serviceType" render={({ field }) => (
            <FormItem className="space-y-3"><FormLabel>نوع الخدمة المطلوبة<span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <RadioGroup onValueChange={(value) => {
                    field.onChange(value);
                    form.reset({
                        ...form.getValues(),
                        serviceType: value as "coaching" | "consultation",
                        selectedSlots: [],
                        paymentProof: undefined,
                    });
                    setSelectedFileName("");
                }} 
                value={field.value} className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4 rtl:md:space-x-reverse" dir="rtl">
                  <FormItem className="flex items-center space-x-2 rtl:space-x-reverse">
                    <FormControl><RadioGroupItem value="coaching" /></FormControl><FormLabel className="font-normal">التدريب الشخصي (Coaching)</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 rtl:space-x-reverse">
                    <FormControl><RadioGroupItem value="consultation" /></FormControl><FormLabel className="font-normal">الاستشارات (Consultation)</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl><FormMessage />
            </FormItem>
          )}
        />
        
        <FormField control={form.control} name="meetingType" render={({ field }) => (
            <FormItem className="space-y-3"><FormLabel>طريقة الجلسة<span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4 rtl:md:space-x-reverse" dir="rtl">
                  <FormItem className="flex items-center space-x-2 rtl:space-x-reverse">
                    <FormControl><RadioGroupItem value="online" /></FormControl><FormLabel className="font-normal">أونلاين (Online)</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 rtl:space-x-reverse">
                    <FormControl><RadioGroupItem value="in-person" /></FormControl><FormLabel className="font-normal">حضوري (Présentiel)</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
               {watchedMeetingType === 'in-person' && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-input space-y-3">
                    <div className="flex items-start gap-3">
                         <MapPin className="h-5 w-5 text-primary mt-1 shrink-0" />
                         <div>
                            <p className="font-semibold text-foreground">العنوان:</p>
                            <p className="text-muted-foreground">16 Rue du Dr Alphonse Laveran, Belvédère 1002, Tunis</p>
                         </div>
                    </div>
                    <div className="aspect-video w-full">
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3193.812398444738!2d10.17763331529107!3d36.82334897994361!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12fd347a4a2a1a8f%3A0x6b3f7f8f7c3b2f5d!2s16%20Rue%20Dr.%20Alphonse%20Laveran%2C%20Tunis!5e0!3m2!1sen!2stn!4v1620214568347!5m2!1sen!2stn"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen={false}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Location Map"
                            className="rounded-md"
                        ></iframe>
                    </div>
                </div>
               )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField control={form.control} name="problemDescription" render={({ field }) => (
            <FormItem><FormLabel>وصف المشكلة أو الاستفسار<span className="text-destructive">*</span></FormLabel>
              <FormControl><Textarea placeholder="صف بالتفصيل ما تحتاج إليه..." {...field} rows={5} /></FormControl><FormMessage />
            </FormItem>
          )}
        />

        <FormField control={form.control} name="selectedSlots" render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>اختر المواعيد المتاحة<span className="text-destructive">*</span></FormLabel>
            <FormDescription>
              {watchedServiceType === 'consultation' ? 'اختر موعدًا واحدًا فقط.' : 'اختر حتى 4 مواعيد، بمعدل موعد واحد في كل يوم.'}
            </FormDescription>
             <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value?.length && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50 rtl:mr-2 rtl:ml-0" />
                      {field.value?.length > 0 ? `${field.value.length} موعد(مواعيد) مختار(ة)` : <span>اختر مواعيدك</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={selectedDay}
                        onSelect={setSelectedDay}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        disabled={(date) => {
                            const isPast = date < new Date(new Date().setDate(new Date().getDate() - 1));
                            const dateStr = format(date, "yyyy-MM-dd");
                            const noSlotsAvailable = !availability[dateStr];
                            const isTodayDate = isToday(date);
                            return isPast || noSlotsAvailable || isTodayDate;
                        }}
                        modifiers={{ available: (date) => !!availability[format(date, "yyyy-MM-dd")] }}
                        modifiersClassNames={{ available: 'bg-green-100 dark:bg-green-900 rounded-full' }}
                        footer={isLoadingAvailability ? <p className="p-2 text-center text-sm">جاري تحميل المواعيد...</p> : 
                                availabilityError ? <p className="p-2 text-center text-sm text-destructive">{availabilityError}</p> :
                                <p className="p-2 text-center text-sm text-muted-foreground">اختر يومًا لعرض الأوقات المتاحة.</p>
                        }
                    />
                     {selectedDay && availability[format(selectedDay, "yyyy-MM-dd")] && (
                        <div className="p-4 border-t max-h-60 overflow-y-auto">
                            <h4 className="font-semibold mb-2">
                                الأوقات المتاحة ليوم: <span className="font-bold">{format(selectedDay, "PPP", { locale: arSA })}</span>
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                            {availability[format(selectedDay, "yyyy-MM-dd")].map(time => {
                                const dateStr = format(selectedDay, "yyyy-MM-dd");
                                const isSelected = watchedSlots.some(s => s.date === dateStr && s.time === time);
                                return (
                                <Button
                                    key={time}
                                    type="button"
                                    variant={isSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleSlotToggle(dateStr, time)}
                                >
                                    {time}
                                </Button>
                                );
                            })}
                            </div>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )} />

        <FormField
            control={form.control}
            name="paymentProof"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>
                        إثبات الدفع
                        {paymentProofIsRequiredForSelectedType && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                        <Input 
                            type="file" 
                            accept={ACCEPTED_IMAGE_TYPES.join(",")}
                            disabled={isTransitionPending}
                            {...fileRef}
                            onChange={(event) => {
                                field.onChange(event.target.files);
                                setSelectedFileName(event.target.files?.[0]?.name || "");
                            }}
                        />
                    </FormControl>
                    <FormDescription>
                        {selectedFileName 
                            ? `الملف المختار: ${selectedFileName}`
                            : paymentProofIsRequiredForSelectedType 
                                ? `مطلوب لخدمة الاستشارة. الحد الأقصى لحجم الملف ${MAX_FILE_SIZE_MB} ميجا بايت.` 
                                : `إثبات الدفع غير مطلوب لخدمة التدريب.`
                        }
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <Button 
          type="submit" 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2" 
          disabled={isTransitionPending}
        >
          {isTransitionPending ? (
            <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري الإرسال...
            </>
          ) : (
            "إرسال الطلب"
          )}
        </Button>
      </form>
    </Form>
  );
}
