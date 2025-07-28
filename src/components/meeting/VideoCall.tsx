
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, addDoc, collection, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ userId, roomId, onHangUp }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState("Starting...");
  const [isCaller, setIsCaller] = useState(false);
  const { toast } = useToast();

  const roomDoc = doc(db, 'rooms', roomId);
  const offerCandidates = collection(roomDoc, 'offerCandidates');
  const answerCandidates = collection(roomDoc, 'answerCandidates');

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStream.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      toast({
        variant: "destructive",
        title: "Media Error",
        description: "Could not access camera or microphone",
      });
      return null;
    }
  };

  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection(rtcConfiguration);

    // Add local stream tracks to peer connection
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, localStream.current!);
      });
    }

    // Handle incoming remote stream
    peerConnection.current.ontrack = (event) => {
      console.log('Remote stream received');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    peerConnection.current.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateCollection = isCaller ? offerCandidates : answerCandidates;
        await addDoc(candidateCollection, event.candidate.toJSON());
      }
    };

    // Handle connection state changes
    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current) {
        console.log('Connection state:', peerConnection.current.connectionState);
        setStatus(`Connected: ${peerConnection.current.connectionState}`);
      }
    };
  };

  const startCall = async () => {
    setStatus("Getting camera and microphone...");
    const stream = await initializeMedia();
    if (!stream) return;

    setStatus("Setting up connection...");
    createPeerConnection();

    // Check if room exists
    const roomSnapshot = await getDoc(roomDoc);
    
    if (!roomSnapshot.exists()) {
      // Create new room (caller)
      setIsCaller(true);
      setStatus("Creating call...");
      
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);
      
      await setDoc(roomDoc, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
      
      setStatus("Waiting for someone to join...");
    } else {
      // Join existing room (callee)
      setIsCaller(false);
      setStatus("Joining call...");
      
      const offerData = roomSnapshot.data()?.offer;
      if (offerData) {
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offerData));
        
        const answer = await peerConnection.current!.createAnswer();
        await peerConnection.current!.setLocalDescription(answer);
        
        await setDoc(roomDoc, {
          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        }, { merge: true });
        
        setStatus("Joined call");
      }
    }
  };

  useEffect(() => {
    startCall();

    // Listen for answer (if caller)
    const unsubscribeRoom = onSnapshot(roomDoc, async (snapshot) => {
      if (!snapshot.exists() || !peerConnection.current) return;
      
      const data = snapshot.data();
      
      if (isCaller && data.answer && !peerConnection.current.remoteDescription) {
        setStatus("Connecting...");
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    // Listen for ICE candidates
    const unsubscribeOfferCandidates = onSnapshot(offerCandidates, (snapshot) => {
      if (!isCaller) {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && peerConnection.current?.remoteDescription) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      }
    });

    const unsubscribeAnswerCandidates = onSnapshot(answerCandidates, (snapshot) => {
      if (isCaller) {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && peerConnection.current?.remoteDescription) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      }
    });

    return () => {
      unsubscribeRoom();
      unsubscribeOfferCandidates();
      unsubscribeAnswerCandidates();
      
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, isCaller]);

  const handleToggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  };

  const handleToggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(prev => !prev);
    }
  };

  const handleHangUp = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
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
          Room: {roomId} | {isCaller ? 'Caller' : 'Callee'} | {status}
          {status.includes('Starting') || status.includes('Getting') || status.includes('Setting') || status.includes('Creating') || status.includes('Joining') || status.includes('Waiting') || status.includes('Connecting') && <Loader2 className="inline h-4 w-4 animate-spin ml-2" />}
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
