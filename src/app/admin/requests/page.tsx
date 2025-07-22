
"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchProviderServiceRequests, 
  updateServiceRequestAdminDetails, 
  createChatSessionFromAdmin, 
  seedServiceRequests,
  deleteServiceRequests, // New action
  type ServiceRequestAdminView 
} from "./actions";
import { scheduleWebRtcConsultation } from "@/app/meeting/actions";
import { 
  Loader2, AlertCircle, Users, Edit, Save, Link as LinkIconLucide, MoreHorizontal, 
  CheckCircle, XCircle, ClockIcon, RefreshCcw, ExternalLink, FileImage, 
  MessageSquare, Video, Database, Laptop, Building, Trash2, FileDown 
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, parseISO } from "date-fns";
import { arSA } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import RequestsDashboard from "@/components/admin/RequestsDashboard"; // New component

const SERVICE_PROVIDER_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1"; 

const STATUS_OPTIONS = [
  { value: "pending", label: "معلق", icon: <ClockIcon className="h-4 w-4" /> },
  { value: "confirmed", label: "مؤكد", icon: <CheckCircle className="h-4 w-4" /> },
  { value: "completed", label: "مكتمل", icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
  { value: "cancelled", label: "ملغى", icon: <XCircle className="h-4 w-4" /> },
];

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "pending": return "outline";
    case "confirmed": return "default";
    case "completed": return "secondary"; 
    case "cancelled": return "destructive";
    default: return "outline";
  }
}

export default function AdminRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isFetching, setIsFetching] = useState(true);

  const [requests, setRequests] = useState<ServiceRequestAdminView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editingRequest, setEditingRequest] = useState<ServiceRequestAdminView | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState<string | null>(null);

  // State for new features
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  
  const filteredRequests = useMemo(() => {
    if (filterStatus === "all") return requests;
    return requests.filter(req => req.status === filterStatus);
  }, [requests, filterStatus]);


  const fetchRequests = async () => {
      if (user && user.uid === SERVICE_PROVIDER_UID) {
        setIsFetching(true);
        const result = await fetchProviderServiceRequests(user.uid);
        if (result.success && result.requests) {
          setRequests(result.requests);
          setError(null);
        } else {
          setError(result.error || "فشل في جلب طلبات الخدمة.");
          setRequests([]);
        }
        setIsFetching(false);
      }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/requests");
    } else if (!authLoading && user && user.uid !== SERVICE_PROVIDER_UID) {
      setError("أنت غير مصرح لك بعرض هذه الصفحة.");
      setRequests([]);
      setIsFetching(false);
    } else if (!authLoading && user) {
      fetchRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);


  const handleSave = async (requestId: string, status: string, meetingUrl: string | null) => {
    startTransition(async () => {
      const result = await updateServiceRequestAdminDetails(requestId, { status, meetingUrl });
      if (result.success) {
        toast({ title: "تم تحديث الطلب", description: "تم حفظ تفاصيل طلب الخدمة." });
        setEditingRequest(null);
        await fetchRequests();
      } else {
        toast({ variant: "destructive", title: "فشل التحديث", description: result.error });
      }
    });
  };

  const handleGenerateMeetingLink = async (request: ServiceRequestAdminView) => {
    setIsGeneratingLink(request.id);
    startTransition(async () => {
        const result = await scheduleWebRtcConsultation(request.id, request.userId, request.userName);
        if (result.success && result.roomId) {
            toast({ title: "تم إنشاء غرفة الاجتماع", description: `تم إنشاء الغرفة بالمعرف: ${result.roomId}` });
            if (editingRequest?.id === request.id) {
              setEditingRequest(prev => prev ? {...prev, meetingUrl: result.roomId } : null);
            }
            await fetchRequests(); 
        } else {
            toast({ variant: "destructive", title: "فشل في إنشاء الرابط", description: result.message });
        }
        setIsGeneratingLink(null);
    });
  };

  const handleStartChat = async (request: ServiceRequestAdminView) => {
      startTransition(async () => {
        const result = await createChatSessionFromAdmin(request.userId, request.userName || `${request.name} ${request.surname}`);
        if(result.success) {
            toast({ title: "المحادثة جاهزة", description: `يمكنك الآن مراسلة ${request.userName}. جاري إعادة التوجيه إلى المحادثة...`});
            router.push(`/admin/chat?chatId=${result.chatId}`);
        } else {
            toast({ variant: "destructive", title: "فشل في بدء المحادثة", description: result.error });
        }
      });
  };

  const handleJoinCall = (roomId: string) => {
    router.push(`/meeting?roomId=${roomId}`);
  };

  const handleSeedData = () => {
    startTransition(async () => {
        const result = await seedServiceRequests();
        if (result.success) {
            toast({ title: "تم ملء قاعدة البيانات", description: "تمت إضافة 6 طلبات خدمة وهمية جديدة." });
            await fetchRequests();
        } else {
            toast({ variant: "destructive", title: "فشل في ملء البيانات", description: result.error });
        }
    });
  };
  
  const handleDeleteSelected = () => {
    if (selectedRequestIds.length === 0) return;
    startTransition(async () => {
        const result = await deleteServiceRequests(selectedRequestIds);
        if (result.success) {
            toast({ title: "تم الحذف بنجاح", description: `تم حذف ${result.deletedCount} طلب(ات).` });
            setSelectedRequestIds([]);
            await fetchRequests();
        } else {
            toast({ variant: "destructive", title: "فشل الحذف", description: result.error });
        }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedRequestIds(filteredRequests.map(req => req.id));
    } else {
        setSelectedRequestIds([]);
    }
  };

  const handleSelectRow = (requestId: string, checked: boolean) => {
      if(checked) {
          setSelectedRequestIds(prev => [...prev, requestId]);
      } else {
          setSelectedRequestIds(prev => prev.filter(id => id !== requestId));
      }
  };

  const exportToCsv = () => {
    if (filteredRequests.length === 0) return;
    const headers = [
      "ID", "Name", "Email", "Phone", "Service Type", "Meeting Type", 
      "Status", "Created At", "Appointment Date", "Appointment Time", "Meeting URL"
    ];
    const rows = filteredRequests.map(req => [
      req.id,
      req.userName,
      req.email,
      req.phone,
      req.serviceType,
      req.meetingType,
      req.status,
      req.createdAt,
      req.selectedSlots[0]?.date || 'N/A',
      req.selectedSlots[0]?.time || 'N/A',
      req.meetingUrl || 'N/A'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `service-requests-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (authLoading || (user && isFetching)) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 rtl:mr-3 text-lg">جاري تحميل الطلبات...</p>
      </div>
    );
  }

  if (!user || (user.uid !== SERVICE_PROVIDER_UID && !authLoading) || error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>تم رفض الوصول أو حدث خطأ</AlertTitle>
          <AlertDescription>{error || "ليس لديك إذن لعرض هذه الصفحة، أو حدث خطأ."}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">العودة إلى الصفحة الرئيسية</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-8">
      
      <RequestsDashboard requests={requests} />
      
      <Card className="max-w-7xl mx-auto shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-bold text-primary">طلبات الخدمة</CardTitle>
                    <CardDescription className="text-lg text-foreground/80 mt-1">
                        عرض وإدارة طلبات الخدمة الواردة.
                    </CardDescription>
                </div>
            </div>
             <div className="flex items-center gap-2 self-end md:self-auto">
                <Button variant="outline" size="icon" onClick={fetchRequests} disabled={isFetching || isPending} title="تحديث البيانات">
                    <RefreshCcw className={`h-5 w-5 ${isFetching ? 'animate-spin': ''}`} />
                </Button>
                <Button variant="outline" size="icon" onClick={handleSeedData} disabled={isPending} title="ملء بيانات وهمية">
                    <Database className="h-5 w-5" />
                </Button>
             </div>
          </div>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="فلترة حسب الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الحالات</SelectItem>
                            {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedRequestIds.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={isPending}>
                            <Trash2 className="ml-2 h-4 w-4" />
                            حذف ({selectedRequestIds.length})
                        </Button>
                    )}
                </div>
                 <Button variant="outline" size="sm" onClick={exportToCsv}>
                    <FileDown className="ml-2 h-4 w-4" />
                    تصدير إلى CSV
                </Button>
            </div>
          {filteredRequests.length === 0 && !isFetching ? (
            <div className="text-center text-muted-foreground py-8">
                <p>لم يتم العثور على طلبات خدمة تطابق الفلتر الحالي.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="p-2">
                                <Checkbox 
                                  checked={selectedRequestIds.length > 0 && selectedRequestIds.length === filteredRequests.length}
                                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                  aria-label="اختر الكل"
                                />
                            </TableHead>
                            <TableHead className="hidden md:table-cell">معرف الطلب</TableHead>
                            <TableHead>العميل</TableHead>
                            <TableHead>الخدمة</TableHead>
                            <TableHead>الموعد</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>
                                <span className="sr-only">الإجراءات</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isFetching ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRequests.map((request) => (
                                <TableRow key={request.id} data-state={selectedRequestIds.includes(request.id) ? 'selected' : ''}>
                                    <TableCell className="p-2">
                                        <Checkbox 
                                            checked={selectedRequestIds.includes(request.id)}
                                            onCheckedChange={(checked) => handleSelectRow(request.id, !!checked)}
                                            aria-label={`اختر الطلب ${request.id}`}
                                        />
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell font-mono text-xs">{request.id.substring(0,8).toUpperCase()}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{request.userName || `${request.name} ${request.surname}`}</div>
                                        <div className="text-sm text-muted-foreground">{request.userEmail || request.email}</div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col">
                                        <span className="capitalize">{request.serviceType === "coaching" ? "تدريب" : "استشارة"}</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1 capitalize">
                                            {request.meetingType === 'online' ? <Laptop className="h-3 w-3" /> : <Building className="h-3 w-3" />}
                                            {request.meetingType === 'online' ? "أونلاين" : "حضوري"}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                        {request.selectedSlots.length > 0 ? (
                                            <div>
                                                <p>{format(parseISO(request.selectedSlots[0].date), "PPP", { locale: arSA })}</p>
                                                <p className="text-muted-foreground">{request.selectedSlots[0].time}</p>
                                            </div>
                                        ) : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusBadgeVariant(request.status)}>
                                            {STATUS_OPTIONS.find(s => s.value === request.status)?.label || request.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">فتح القائمة</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setEditingRequest(request)}>
                                                    <Edit className="ml-2 h-4 w-4" />
                                                    <span>عرض التفاصيل والتعديل</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStartChat(request)} disabled={isPending}>
                                                    <MessageSquare className="ml-2 h-4 w-4" />
                                                    <span>بدء المحادثة</span>
                                                </DropdownMenuItem>
                                                {request.meetingUrl && (
                                                    <DropdownMenuItem onClick={() => handleJoinCall(request.meetingUrl!)} disabled={isPending}>
                                                        <Video className="ml-2 h-4 w-4" />
                                                        <span>الانضمام للمكالمة</span>
                                                    </DropdownMenuItem>
                                                )}
                                                {request.paymentProofInfo?.cloudinaryUrl && (
                                                  <DropdownMenuItem asChild>
                                                    <Link href={request.paymentProofInfo.cloudinaryUrl} target="_blank" rel="noopener noreferrer">
                                                      <FileImage className="ml-2 h-4 w-4" />
                                                      <span>عرض إثبات الدفع</span>
                                                    </Link>
                                                  </DropdownMenuItem>
                                                )}
                                                 <DropdownMenuSeparator />
                                                 <DropdownMenuItem onClick={() => handleDeleteSelected()} disabled={isPending || selectedRequestIds.length === 0}>
                                                    <Trash2 className="ml-2 h-4 w-4 text-destructive" />
                                                    <span className="text-destructive">حذف</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {editingRequest && (
        <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
            <DialogContent className="sm:max-w-[600px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تفاصيل الطلب</DialogTitle>
                    <DialogDescription>
                        عرض الطلب رقم: {editingRequest.id.substring(0, 8).toUpperCase()}. يمكنك تحديث الحالة ومعرف غرفة الاجتماع هنا.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">العميل</Label>
                        <div className="col-span-3">{editingRequest.userName} ({editingRequest.email})</div>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">الهاتف</Label>
                        <div className="col-span-3">{editingRequest.phone}</div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">الاجتماع</Label>
                        <div className="col-span-3 capitalize flex items-center gap-2">
                           {editingRequest.meetingType === 'online' ? <Laptop className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                           {editingRequest.meetingType  === 'online' ? 'أونلاين' : 'حضوري'}
                        </div>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">الاستفسار</Label>
                        <p className="col-span-3 text-sm text-foreground/80 bg-muted/50 p-2 rounded-md whitespace-pre-wrap max-h-24 overflow-y-auto">{editingRequest.problemDescription}</p>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status-select" className="text-right">الحالة</Label>
                        <Select
                            dir="rtl"
                            defaultValue={editingRequest.status}
                            onValueChange={(value) => setEditingRequest(prev => prev ? {...prev, status: value} : null)}
                        >
                            <SelectTrigger id="status-select" className="col-span-3">
                                <SelectValue placeholder="اختر حالة" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="meeting-url" className="text-right">غرفة الاجتماع</Label>
                        <div className="col-span-3 flex gap-2">
                             <Input 
                                id="meeting-url"
                                value={editingRequest.meetingUrl || ''} 
                                onChange={(e) => setEditingRequest(prev => prev ? {...prev, meetingUrl: e.target.value} : null)}
                                placeholder="digitalmen0-webrtc-..."
                             />
                             <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => handleGenerateMeetingLink(editingRequest)}
                                disabled={isGeneratingLink === editingRequest.id || isPending}
                             >
                                 {isGeneratingLink === editingRequest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                             </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                     <DialogClose asChild>
                        <Button variant="outline">إلغاء</Button>
                    </DialogClose>
                    <Button onClick={() => handleSave(editingRequest.id, editingRequest.status, editingRequest.meetingUrl || null)} disabled={isPending}>
                        <Save className="ml-2 h-4 w-4" />
                        {isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
