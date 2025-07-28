
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, addDoc, collection, getDoc, deleteDoc } from 'firebase/firestore';
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
  const [isInitiator, setIsInitiator] = useState(false);
  const { toast } = useToast();

  const roomRef = doc(db, 'webrtc_rooms', roomId);
  const offerCandidatesRef = collection(roomRef, 'offerCandidates');
  const answerCandidatesRef = collection(roomRef, 'answerCandidates');

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
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
    peerConnection.current = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, localStream.current!);
      });
    }

    // Handle remote stream
    peerConnection.current.ontrack = (event) => {
      console.log('Remote stream received:', event.streams[0]);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setStatus("Connected!");
      }
    };

    // Handle ICE candidates
    peerConnection.current.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateCollection = isInitiator ? offerCandidatesRef : answerCandidatesRef;
        await addDoc(candidateCollection, {
          candidate: event.candidate.toJSON(),
          timestamp: new Date().toISOString()
        });
      }
    };

    // Handle connection state
    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current) {
        console.log('Connection state:', peerConnection.current.connectionState);
        setStatus(`Connection: ${peerConnection.current.connectionState}`);
      }
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      if (peerConnection.current) {
        console.log('ICE connection state:', peerConnection.current.iceConnectionState);
      }
    };
  };

  const startCall = async () => {
    setStatus("Getting camera and microphone...");
    const stream = await getLocalStream();
    if (!stream) return;

    setStatus("Setting up connection...");
    createPeerConnection();

    // Check if room exists
    const roomSnapshot = await getDoc(roomRef);
    
    if (!roomSnapshot.exists()) {
      // Create new room (initiator)
      setIsInitiator(true);
      setStatus("Creating call...");
      
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);
      
      await setDoc(roomRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        },
        created: new Date().toISOString()
      });
      
      setStatus("Waiting for someone to join...");
    } else {
      // Join existing room (receiver)
      setIsInitiator(false);
      setStatus("Joining call...");
      
      const offerData = roomSnapshot.data()?.offer;
      if (offerData) {
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offerData));
        
        const answer = await peerConnection.current!.createAnswer();
        await peerConnection.current!.setLocalDescription(answer);
        
        await setDoc(roomRef, {
          answer: {
            type: answer.type,
            sdp: answer.sdp
          },
          joined: new Date().toISOString()
        }, { merge: true });
        
        setStatus("Joined call");
      }
    }
  };

  useEffect(() => {
    startCall();

    // Listen for answer (if initiator)
    const unsubscribeRoom = onSnapshot(roomRef, async (snapshot) => {
      if (!snapshot.exists() || !peerConnection.current) return;
      
      const data = snapshot.data();
      
      if (isInitiator && data.answer && !peerConnection.current.remoteDescription) {
        setStatus("Connecting...");
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    // Listen for ICE candidates
    const unsubscribeOfferCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
      if (!isInitiator) {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && peerConnection.current?.remoteDescription) {
            const candidateData = change.doc.data();
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
          }
        });
      }
    });

    const unsubscribeAnswerCandidates = onSnapshot(answerCandidatesRef, (snapshot) => {
      if (isInitiator) {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && peerConnection.current?.remoteDescription) {
            const candidateData = change.doc.data();
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
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
  }, [roomId, isInitiator]);

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

  const handleHangUp = async () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }
    
    // Clean up room
    try {
      await deleteDoc(roomRef);
    } catch (error) {
      console.error('Error cleaning up room:', error);
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
          Room: {roomId} | {isInitiator ? 'Initiator' : 'Receiver'} | {status}
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
