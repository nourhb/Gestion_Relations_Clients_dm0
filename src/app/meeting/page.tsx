"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, LogIn, AlertCircle, RefreshCw, PhoneOff } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import VideoCall from '@/components/meeting/VideoCall'; 
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function MeetingPageContent() {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualRoomIdInput, setManualRoomIdInput] = useState<string>('');
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading: authLoading } = useAuth();

  // Generate anonymous ID for guests
  const generateAnonymousId = useCallback(() => {
    return `user_meeting_${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  // Get user ID (authenticated or anonymous)
  const videoCallUserId = currentUser?.uid || generateAnonymousId();

  useEffect(() => {
    // Check for roomId in URL params
    const roomIdFromUrl = searchParams.get('roomId');
    if (roomIdFromUrl && roomIdFromUrl.trim()) {
      console.log(`[MeetingPage] Room ID found in URL: ${roomIdFromUrl}`);
      setCurrentRoomId(roomIdFromUrl.trim());
      setErrorMsg(null);
    }
  }, [searchParams]);

  const handleJoinCall = useCallback((roomIdToJoin: string) => {
    if (!roomIdToJoin || roomIdToJoin.trim() === "") {
      toast({ variant: 'destructive', title: 'Input Error', description: 'Room ID cannot be empty.' });
      return;
    }
    console.log(`[MeetingPage] Attempting to join call in room: ${roomIdToJoin}`);
    console.log(`[MeetingPage] user:`, currentUser, `videoCallUserId: ${videoCallUserId}`, `anonymousId: ${generateAnonymousId()}`);
    setCurrentRoomId(roomIdToJoin.trim());
    setErrorMsg(null);
  }, [toast, currentUser, videoCallUserId, generateAnonymousId]);

  const handleLeaveCall = useCallback(() => {
    console.log("[MeetingPage] User requested to leave call.");
    toast({ title: "انتهت المكالمة", description: "لقد غادرت استشارة الفيديو." });
    setCurrentRoomId(null);
    setManualRoomIdInput('');
    router.replace('/');
  }, [router, toast]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="mr-2 h-8 w-8 animate-spin text-primary" />
        <p>Loading user authentication...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">جلسات الفيديو المباشرة</h1>
          <p className="text-muted-foreground">تواصل مباشرة عبر الفيديو باستخدام WebRTC.</p>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Video className="mr-2 h-5 w-5 text-primary" /> 
            واجهة الاتصال المرئي
          </CardTitle>
          <CardDescription>
            {currentRoomId ? `أنت في الغرفة: ${currentRoomId}` : 'أدخل معرف الغرفة للانضمام أو البدء.'}
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

          {currentRoomId ? (
            <VideoCall 
              userId={videoCallUserId} 
              roomId={currentRoomId} 
              onHangUp={handleLeaveCall} 
            />
          ) : (
            <div className="space-y-3 max-w-md mx-auto">
              <div>
                <Label htmlFor="room-id-input">أدخل معرف الغرفة للانضمام/البدء</Label>
                <Input
                  id="room-id-input"
                  type="text"
                  placeholder="مثال: aRyYjDSvsJLF3kqZ9IFS"
                  value={manualRoomIdInput}
                  onChange={(e) => setManualRoomIdInput(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={() => handleJoinCall(manualRoomIdInput)}
                disabled={!manualRoomIdInput.trim()}
                className="w-full"
              >
                <LogIn className="mr-2 h-4 w-4" />
                انضم / ابدأ المكالمة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MeetingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="mr-2 h-8 w-8 animate-spin text-primary" />
        <p>Loading meeting page...</p>
      </div>
    }>
      <MeetingPageContent />
    </Suspense>
  );
}
