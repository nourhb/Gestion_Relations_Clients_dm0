
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ userId, roomId, onHangUp }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [isHost, setIsHost] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const roomRef = doc(db, 'rooms', roomId);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${timestamp}: ${message}`;
    console.log(logMessage);
    setDebugLogs(prev => [...prev, logMessage]);
  };

  const getMediaStream = async () => {
    try {
      addLog("Requesting camera and microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      addLog(`Got stream with ${stream.getTracks().length} tracks`);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
        addLog("Local video playing");
      }
      
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      addLog(`Media error: ${error}`);
      toast({
        variant: "destructive",
        title: "Media Error",
        description: "Could not access camera or microphone",
      });
      return null;
    }
  };

  const createPeerConnection = () => {
    addLog("Creating peer connection...");
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
        addLog(`Added ${track.kind} track`);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      addLog("Remote track received!");
      
      if (remoteVideoRef.current && event.streams[0]) {
        // Clear any existing stream
        remoteVideoRef.current.srcObject = null;
        
        // Set new stream
        remoteVideoRef.current.srcObject = event.streams[0];
        
        // Play the video
        remoteVideoRef.current.play().then(() => {
          addLog("Remote video playing successfully");
          setStatus("Connected!");
        }).catch(err => {
          addLog(`Remote video play failed: ${err}`);
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addLog("ICE candidate generated");
        setDoc(roomRef, {
          iceCandidate: event.candidate.toJSON(),
          from: userId,
          timestamp: Date.now()
        }, { merge: true }).catch(err => {
          addLog(`Failed to save ICE candidate: ${err}`);
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      addLog(`Connection state: ${pc.connectionState}`);
      setStatus(`Connection: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      addLog(`ICE connection state: ${pc.iceConnectionState}`);
    };

    pc.onicegatheringstatechange = () => {
      addLog(`ICE gathering state: ${pc.iceGatheringState}`);
    };

    pc.onsignalingstatechange = () => {
      addLog(`Signaling state: ${pc.signalingState}`);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    addLog("Starting call...");
    setStatus("Getting media...");
    
    const stream = await getMediaStream();
    if (!stream) return;

    setStatus("Setting up connection...");
    const pc = createPeerConnection();

    // Check if room exists
    addLog("Checking if room exists...");
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      // Create room as host
      setIsHost(true);
      setStatus("Creating call...");
      addLog("Creating room as host");
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog("Offer created and set as local description");
      
      await setDoc(roomRef, {
        offer: offer,
        host: userId,
        timestamp: Date.now()
      });
      addLog("Room document created with offer");
      
      setStatus("Waiting for someone to join...");
    } else {
      // Join as guest
      setIsHost(false);
      setStatus("Joining call...");
      addLog("Joining room as guest");
      
      const data = roomDoc.data();
      if (data.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        addLog("Remote description set from offer");
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        addLog("Answer created and set as local description");
        
        await setDoc(roomRef, {
          answer: answer,
          guest: userId,
          timestamp: Date.now()
        }, { merge: true });
        addLog("Answer sent to Firestore");
        
        setStatus("Joined call");
      }
    }
  };

  useEffect(() => {
    startCall();

    // Listen for room updates
    const unsubscribe = onSnapshot(roomRef, async (snapshot) => {
      if (!snapshot.exists() || !peerConnectionRef.current) return;
      
      const data = snapshot.data();
      addLog(`Room updated: ${Object.keys(data).join(', ')}`);
      
      // Handle answer (for host)
      if (isHost && data.answer && !peerConnectionRef.current.remoteDescription) {
        setStatus("Connecting...");
        addLog("Received answer, setting remote description");
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
      
      // Handle offer (for guest)
      if (!isHost && data.offer && !peerConnectionRef.current.remoteDescription) {
        setStatus("Connecting...");
        addLog("Received offer, setting remote description");
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        addLog("Answer created and sent");
        
        await setDoc(roomRef, {
          answer: answer,
          guest: userId,
          timestamp: Date.now()
        }, { merge: true });
      }
      
      // Handle ICE candidates
      if (data.iceCandidate && data.from !== userId && peerConnectionRef.current.remoteDescription) {
        addLog("Adding ICE candidate");
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.iceCandidate));
      }
    });

    return () => {
      addLog("Component unmounting, cleaning up...");
      unsubscribe();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, isHost, userId]);

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
      addLog(`Audio ${isMuted ? 'enabled' : 'disabled'}`);
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(prev => !prev);
      addLog(`Video ${isVideoOff ? 'enabled' : 'disabled'}`);
    }
  };

  const handleHangUp = () => {
    addLog("Hanging up...");
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
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

      {/* Debug Logs */}
      <div className="mt-4 p-3 bg-gray-100 rounded text-xs max-h-40 overflow-y-auto">
        <h4 className="font-bold mb-2">Debug Logs:</h4>
        {debugLogs.map((log, index) => (
          <div key={index} className="text-gray-600 mb-1">{log}</div>
        ))}
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
