
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SimplePeer from 'simple-peer';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ userId, roomId, onHangUp }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [isHost, setIsHost] = useState(false);
  const { toast } = useToast();

  const roomRef = doc(db, 'rooms', roomId);

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.error);
      }
      
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error('Media access error:', error);
      toast({
        variant: "destructive",
        title: "Media Error",
        description: "Could not access camera or microphone",
      });
      return null;
    }
  };

  const createPeer = (initiator: boolean) => {
    const peer = new SimplePeer({
      initiator,
      stream: localStreamRef.current,
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      console.log('Signal data:', data);
      setDoc(roomRef, {
        signal: data,
        from: userId,
        timestamp: Date.now()
      }, { merge: true });
    });

    peer.on('stream', (stream) => {
      console.log('Remote stream received!');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(console.error);
        setStatus("Connected!");
      }
    });

    peer.on('connect', () => {
      console.log('Peer connected!');
      setStatus("Connected!");
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setStatus("Connection error");
    });

    peer.on('close', () => {
      console.log('Peer connection closed');
      setStatus("Disconnected");
    });

    peerRef.current = peer;
    return peer;
  };

  const startCall = async () => {
    setStatus("Getting media...");
    const stream = await getMediaStream();
    if (!stream) return;

    setStatus("Setting up connection...");
    
    // Check if room exists
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      // Create room as host
      setIsHost(true);
      setStatus("Creating call...");
      createPeer(true);
      setStatus("Waiting for someone to join...");
    } else {
      // Join as guest
      setIsHost(false);
      setStatus("Joining call...");
      const peer = createPeer(false);
      
      // Check for existing signal
      const data = roomDoc.data();
      if (data.signal && data.from !== userId) {
        peer.signal(data.signal);
        setStatus("Connecting...");
      }
    }
  };

  useEffect(() => {
    startCall();

    // Listen for room updates
    const unsubscribe = onSnapshot(roomRef, async (snapshot) => {
      if (!snapshot.exists() || !peerRef.current) return;
      
      const data = snapshot.data();
      
      // Handle incoming signals
      if (data.signal && data.from !== userId) {
        console.log('Received signal from:', data.from);
        peerRef.current.signal(data.signal);
        setStatus("Connecting...");
      }
    });

    return () => {
      unsubscribe();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, userId]);

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(prev => !prev);
    }
  };

  const handleHangUp = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    onHangUp();
  };

  const handleShareLink = async () => {
    const link = `${window.location.origin}/meeting?roomId=${roomId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Link Copied!",
        description: "Room link copied to clipboard",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy link",
      });
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg shadow-md bg-card">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Room: {roomId} | {isHost ? 'Host' : 'Guest'} | {status}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <h3 className="text-center font-medium mb-2">You</h3>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-auto rounded-md bg-black aspect-video object-cover transform scale-x-[-1]" 
          />
        </div>
        <div className="relative">
          <h3 className="text-center font-medium mb-2">Remote User</h3>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-auto rounded-md bg-black aspect-video object-cover transform scale-x-[-1]" 
          />
        </div>
      </div>

      <div className="flex justify-center space-x-2 md:space-x-3 mt-4">
        <Button 
          onClick={handleToggleMute} 
          variant={isMuted ? "secondary" : "outline"} 
          size="icon" 
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button 
          onClick={handleToggleVideo} 
          variant={isVideoOff ? "secondary" : "outline"} 
          size="icon" 
          aria-label={isVideoOff ? "Turn Video On" : "Turn Video Off"}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
        </Button>
        <Button 
          onClick={handleShareLink} 
          variant="outline" 
          size="icon" 
          aria-label="Share Room Link"
        >
          <Share2 className="h-5 w-5" />
        </Button>
        <Button 
          onClick={handleHangUp} 
          variant="destructive" 
          size="icon" 
          aria-label="Hang Up"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default VideoCall;
