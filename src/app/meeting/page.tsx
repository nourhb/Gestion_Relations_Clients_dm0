
"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, LogIn, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import VideoCall from '@/components/meeting/VideoCall'; 
import { useRouter, useSearchParams } from 'next/navigation';

const generateAnonymousId = () => {
    return 'user_meeting_' + Math.random().toString(36).substring(2, 15);
};


export default function MeetingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualRoomIdInput, setManualRoomIdInput] = useState<string>('');
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to manage anonymous user ID
  useEffect(() => {
    let currentId = localStorage.getItem('anonymousMeetingId');
    if (!currentId) {
      currentId = generateAnonymousId();
      localStorage.setItem('anonymousMeetingId', currentId);
    }
    setAnonymousId(currentId);
    setIsLoading(false);
  }, []);
  
  const handleJoinCall = useCallback((roomIdToJoin: string) => {
    if (!roomIdToJoin || roomIdToJoin.trim() === "") {
      toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'لا يمكن أن يكون معرف الغرفة فارغًا.' });
      return;
    }
    const trimmedRoomId = roomIdToJoin.trim();
    console.log(`[MeetingPage] Attempting to join call in room: ${trimmedRoomId}`);
    
    // Update the URL without causing a full navigation that might remount everything
    router.replace(`/meeting?roomId=${trimmedRoomId}`, { scroll: false });
    setCurrentRoomId(trimmedRoomId);
    setErrorMsg(null);
  }, [router, toast]);


  const handleLeaveCall = useCallback(() => {
    console.log("[MeetingPage] User requested to leave call.");
    toast({ title: "انتهت المكالمة", description: "لقد غادرت استشارة الفيديو." });
    setCurrentRoomId(null);
    setManualRoomIdInput(''); 
    router.replace('/meeting', { scroll: false }); 
  }, [router, toast]);


  useEffect(() => {
      if (isLoading) return;

      const roomIdFromQuery = searchParams.get('roomId');
      if (roomIdFromQuery && roomIdFromQuery !== currentRoomId) {
          handleJoinCall(roomIdFromQuery);
      } else if (!roomIdFromQuery && currentRoomId) {
          // This case handles when the user manually removes roomId from URL
          // or uses back button.
          setCurrentRoomId(null);
      }
  }, [isLoading, searchParams, currentRoomId, handleJoinCall]); 

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <RefreshCw className="mr-2 h-8 w-8 animate-spin text-primary" />
        <p>جاري تحميل غرفة الاجتماع...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 container mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">جلسات الفيديو المباشرة</h1>
          <p className="text-muted-foreground">تواصل مباشرةً عبر الفيديو باستخدام WebRTC.</p>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-primary"><Video className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" /> واجهة الاتصال المرئي</CardTitle>
          <CardDescription>
            {currentRoomId ? `أنت في الغرفة: ${currentRoomId}` : 'أدخل معرف الغرفة أو استخدم الرابط المرسل إليك للبدء.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && !currentRoomId && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>خطأ</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {anonymousId && currentRoomId ? (
            // Using a key here is CRITICAL. It tells React to create a new instance of VideoCall
            // whenever the roomId changes, ensuring a clean state for each call.
            <VideoCall key={currentRoomId} userId={anonymousId} roomId={currentRoomId} onHangUp={handleLeaveCall} />
          ) : (
            <div className="space-y-3 max-w-md mx-auto">
              <div>
                <Label htmlFor="room-id-input">أدخل معرف الغرفة للبدء أو الانضمام</Label>
                <Input
                  id="room-id-input"
                  type="text"
                  placeholder="e.g., digitalmen0-webrtc-xxxxxx"
                  value={manualRoomIdInput}
                  onChange={(e) => setManualRoomIdInput(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={() => handleJoinCall(manualRoomIdInput)}
                disabled={!manualRoomIdInput.trim() || !!currentRoomId}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <LogIn className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0" />
                انضم / ابدأ الجلسة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
