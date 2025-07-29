"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import VideoCall from '@/components/meeting/VideoCall';
import WherebyProvider from '@/components/meeting/WherebyProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MeetingPageContent = () => {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [isInCall, setIsInCall] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    const roomId = searchParams.get('roomId');
    if (roomId) {
      setCurrentRoomId(roomId);
    }
  }, [searchParams]);

  const handleJoinCall = () => {
    if (inputRoomId.trim()) {
      setCurrentRoomId(inputRoomId.trim());
      setIsInCall(true);
      setCallEnded(false);
    }
  };

  const handleLeaveCall = () => {
    setIsInCall(false);
    setCallEnded(true);
    setCurrentRoomId('');
    setInputRoomId('');
  };

  const generateVideoCallUserId = () => {
    if (user) {
      return user.uid;
    }
    return `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  if (callEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Call Ended</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">The video call has ended.</p>
            <Button onClick={() => setCallEnded(false)} className="w-full">
              Start New Call
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isInCall && currentRoomId) {
    return (
      <div className="min-h-screen bg-gray-900">
        <WherebyProvider>
          <VideoCall
            userId={generateVideoCallUserId()}
            roomId={currentRoomId}
            onHangUp={handleLeaveCall}
          />
        </WherebyProvider>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Join Video Call</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="roomId" className="text-sm font-medium">
              Room ID
            </label>
            <Input
              id="roomId"
              type="text"
              placeholder="Enter room ID"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinCall()}
            />
          </div>
          <Button onClick={handleJoinCall} className="w-full" disabled={!inputRoomId.trim()}>
            Join Call
          </Button>
          <div className="text-center text-sm text-gray-500">
            {user ? `Logged in as: ${user.email}` : 'Joining as guest'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function MeetingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MeetingPageContent />
    </Suspense>
  );
}
