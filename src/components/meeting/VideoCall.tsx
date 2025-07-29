
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRoomConnection } from "@whereby.com/browser-sdk/react";
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ userId, roomId, onHangUp }) => {
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(true);
  const [isLocalScreenshareActive, setIsLocalScreenshareActive] = useState(false);
  const { toast } = useToast();

  // Create room URL for Whereby
  const roomUrl = `https://meet.whereby.com/${roomId}`;

  const roomConnection = useRoomConnection(roomUrl, {
    localMediaOptions: {
      audio: true,
      video: true
    }
  });

  const { actions, components, state } = roomConnection;
  const { VideoView } = components;
  const {
    localParticipant,
    remoteParticipants,
    screenshares,
  } = state;
  const {
    toggleCamera,
    toggleMicrophone,
    startScreenshare,
    stopScreenshare,
    leaveRoom
  } = actions;

  const handleToggleCamera = () => {
    setIsCameraActive(prev => !prev);
    toggleCamera();
  };

  const handleToggleMicrophone = () => {
    setIsMicrophoneActive(prev => !prev);
    toggleMicrophone();
  };

  const handleToggleScreenshare = () => {
    if (isLocalScreenshareActive) {
      stopScreenshare();
    } else {
      startScreenshare();
    }
    setIsLocalScreenshareActive(prev => !prev);
  };

  const handleHangUp = async () => {
    try {
      await leaveRoom();
      onHangUp();
    } catch (error) {
      console.error('Error leaving room:', error);
      onHangUp();
    }
  };

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}/meeting?roomId=${roomId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "تم نسخ الرابط", description: "تم نسخ رابط الغرفة إلى الحافظة." });
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل نسخ الرابط.' });
    }
  };

  function getDisplayName(id: string) {
    return remoteParticipants.find((p) => p.id === id)?.displayName || "Guest";
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gray-900 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 right-4 z-10 text-white text-center">
        <h3 className="text-lg font-semibold">مكالمة فيديو</h3>
        <p className="text-sm text-muted-foreground mb-2">
          Room: {roomId} | {remoteParticipants.length > 0 ? 'Connected' : 'Waiting for others...'}
        </p>
      </div>

      <div className="relative w-full h-full flex items-center justify-center">
        {/* Remote Video */}
        {remoteParticipants[0]?.stream ? (
          <div className="w-full h-full">
            <VideoView 
              stream={remoteParticipants[0].stream} 
              className="w-full h-full object-cover"
            />
            <p className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              {getDisplayName(remoteParticipants[0].id)}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-xl">Waiting for others to join...</p>
              <p className="text-sm text-gray-400 mt-2">Share the room link with someone</p>
            </div>
          </div>
        )}

        {/* Screenshare */}
        {screenshares[0]?.stream && (
          <div className="absolute inset-0 z-20">
            <VideoView stream={screenshares[0].stream} className="w-full h-full object-contain" />
            <p className="absolute top-4 left-4 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              {screenshares[0].isLocal ? "Screenshare (You)" : `Screenshare (${getDisplayName(screenshares[0].participantId)})`}
            </p>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localParticipant?.stream && isCameraActive && (
          <div className="absolute bottom-4 right-4 w-32 h-24 md:w-48 md:h-36 bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 border-primary z-30">
            <VideoView 
              muted 
              stream={localParticipant.stream} 
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            <p className="absolute bottom-1 left-1 text-white text-xs bg-black bg-opacity-50 px-1 rounded">
              You
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-center space-x-2 md:space-x-3 mt-4">
        <Button onClick={handleToggleMicrophone} variant="secondary" size="icon">
          {isMicrophoneActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button onClick={handleToggleCamera} variant="secondary" size="icon">
          {isCameraActive ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button onClick={handleToggleScreenshare} variant="secondary" size="icon">
          <Share2 className="h-5 w-5" />
        </Button>
        <Button onClick={handleHangUp} variant="destructive" size="icon">
          <PhoneOff className="h-5 w-5" />
        </Button>
        <Button onClick={handleShareLink} variant="secondary" size="icon">
          <Share2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default VideoCall;
