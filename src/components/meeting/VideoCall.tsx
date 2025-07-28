
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

const VideoCall: React.FC<VideoCallProps> = ({ userId, roomId, onHangUp }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState<string>("Initializing...");
  const { toast } = useToast();

  const roomDocRef = useCallback(() => doc(db, 'videoCallRooms', roomId), [roomId]);
  const offerCandidatesCollectionRef = useCallback(() => collection(db, 'videoCallRooms', roomId, 'offerCandidates'), [roomId]);
  const answerCandidatesCollectionRef = useCallback(() => collection(db, 'videoCallRooms', roomId, 'answerCandidates'), [roomId]);

  const setupPeerConnection = useCallback(() => {
    if (pc.current && pc.current.signalingState !== 'closed') {
      console.log("[WebRTC] PeerConnection may already exist and is not closed. Previous instance will be cleaned up by useEffect return or manually before new setup if needed.");
    }
    
    console.log("[WebRTC] Creating new RTCPeerConnection");
    pc.current = new RTCPeerConnection(servers);

    pc.current.onicecandidate = async (event) => {
      if (event.candidate && pc.current?.localDescription) {
        console.log("[WebRTC] Found ICE candidate (first 20 chars):", event.candidate.candidate.substring(0,20));
        const targetCollection = pc.current.localDescription.type === 'offer' 
          ? offerCandidatesCollectionRef() 
          : answerCandidatesCollectionRef();
        try {
          await addDoc(targetCollection, { ...event.candidate.toJSON(), senderId: userId });
          console.log(`[WebRTC] Sent ${pc.current.localDescription.type} candidate`);
        } catch (error) {
          console.error(`[WebRTC] Error sending ${pc.current.localDescription.type} candidate:`, error)
        }
      }
    };

    pc.current.ontrack = (event) => {
      console.log("[WebRTC] Received remote track:", event.streams[0]);
      setCallStatus("Remote stream received.");
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          console.log("[WebRTC] Remote video stream attached to video element.");
        } else {
           console.warn("[WebRTC] Remote video ref not available when remote track was received.");
        }
      }
    };

    pc.current.onconnectionstatechange = () => {
      if (pc.current) {
        console.log(`[WebRTC] Connection state: ${pc.current.connectionState}`);
        setCallStatus(`Connection: ${pc.current.connectionState}`); 
        if (pc.current.connectionState === 'connected') {
             // setCallStatus("Connected"); // Already handled
        } else if (['disconnected', 'failed', 'closed'].includes(pc.current.connectionState)) {
            console.warn(`[WebRTC] Peer connection state is ${pc.current.connectionState}. Call might be ending or failing.`);
        }
      }
    };
    pc.current.onsignalingstatechange = () => {
        if(pc.current) {
            console.log(`[WebRTC] Signaling state: ${pc.current.signalingState}`);
        }
    };
    pc.current.oniceconnectionstatechange = () => {
        if(pc.current) {
            console.log(`[WebRTC] ICE connection state: ${pc.current.iceConnectionState}`);
             if (pc.current.iceConnectionState === 'failed') {
                console.error("[WebRTC] ICE connection failed. Restarting ICE might be needed for complex NATs, or check STUN/TURN.");
                setCallStatus("ICE connection failed");
            }
        }
    }
  }, [offerCandidatesCollectionRef, answerCandidatesCollectionRef, userId]);

  const startLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      console.log("[WebRTC] Local stream already exists.");
      if (localVideoRef.current && !localVideoRef.current.srcObject) {
         localVideoRef.current.srcObject = localStreamRef.current; 
         console.log("[WebRTC] Re-attached existing local stream to video element.");
      }
      if (pc.current && pc.current.signalingState !== 'closed') {
        localStreamRef.current.getTracks().forEach((track) => {
            if (!pc.current?.getSenders().find(s => s.track === track)) {
                 console.log("[WebRTC] Re-adding local track to PeerConnection:", track.kind);
                 pc.current?.addTrack(track, localStreamRef.current!);
            }
        });
      }
      setCallStatus("Local stream ready."); // Update status even if stream reused
      return localStreamRef.current;
    }
    try {
      console.log("[WebRTC] Requesting local media stream...");
      setCallStatus("Requesting media access...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("[WebRTC] Local video stream attached to video element.");
      } else {
        console.warn("[WebRTC] Local video ref not available when stream was ready.");
      }
      
      if (pc.current && pc.current.signalingState !== 'closed') {
        stream.getTracks().forEach((track) => {
           console.log("[WebRTC] Adding initial local track to PeerConnection:", track.kind);
           pc.current?.addTrack(track, stream);
        });
      } else {
        console.warn("[WebRTC] pc.current not ready or closed when trying to add initial local tracks.");
      }
      setCallStatus("Local stream started."); 
      return stream;
    } catch (error) {
      console.error("[WebRTC] Error accessing media devices.", error);
      setCallStatus("Error: Could not access camera/microphone.");
      toast({
        variant: "destructive",
        title: "Media Access Error",
        description: "Could not access your camera or microphone. Please check permissions.",
      });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    console.log(`[WebRTC EFFECT] Mount/Update for roomId: ${roomId}, userId: ${userId}`);
    
    let isMounted = true;
    const currentPcRef = pc; 

    const cleanup = async () => {
      console.log("[WebRTC EFFECT CLEANUP] Cleaning up for roomId:", roomId);

      if (currentPcRef.current) {
        currentPcRef.current.getSenders().forEach(sender => {
          if (sender.track) sender.track.stop();
        });
        currentPcRef.current.close();
        currentPcRef.current = null; 
        console.log("[WebRTC EFFECT CLEANUP] PeerConnection closed.");
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        console.log("[WebRTC EFFECT CLEANUP] Local stream stopped.");
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      try {
        const currentRoomDoc = roomDocRef();
        const roomSnap = await getDoc(currentRoomDoc);
        if (roomSnap.exists() && isMounted) { 
          const roomData = roomSnap.data();
          const participants = roomData.participants || [];
          const updatedParticipants = participants.filter((pId: string) => pId !== userId);

          if (updatedParticipants.length === 0 && roomData.offer?.sdp) { // Only delete if I created the offer and am last
            console.log("[WebRTC EFFECT CLEANUP] Last participant who created offer left. Deleting room and candidates.");
            const batch = writeBatch(db);
            const offerCandSnap = await getDocs(offerCandidatesCollectionRef());
            offerCandSnap.forEach(doc => batch.delete(doc.ref));
            const answerCandSnap = await getDocs(answerCandidatesCollectionRef());
            answerCandSnap.forEach(doc => batch.delete(doc.ref));
            batch.delete(currentRoomDoc);
            await batch.commit();
          } else if (participants.includes(userId)) {
            await updateDoc(currentRoomDoc, { participants: updatedParticipants });
            console.log("[WebRTC EFFECT CLEANUP] Updated participants list.");
          }
        }
      } catch (error) {
        console.error("[WebRTC EFFECT CLEANUP] Error cleaning up Firestore room:", error);
      }
    };
    
    const initializeMediaAndSignaling = async () => {
      if (!isMounted) return;
      console.log("[WebRTC INIT] Initializing media and signaling...");
      setupPeerConnection(); 

      if (!pc.current) {
        console.error("[WebRTC INIT] PeerConnection not initialized after setup. Cannot proceed.");
        if (isMounted) setCallStatus("Error: PeerConnection setup failed.");
        return;
      }
      
      const stream = await startLocalStream();
      if (!stream || !localStreamRef.current) {
          console.warn("[WebRTC INIT] Local stream not available. Cannot proceed with signaling.");
          return;
      }

      if (!pc.current || pc.current.signalingState === 'closed') {
        console.warn("[WebRTC INIT] PeerConnection is closed or null before signaling. Aborting.");
        if (isMounted) setCallStatus("Error: PeerConnection closed unexpectedly.");
        return;
      }
      
      if (isMounted) setCallStatus("Checking room status...");
      const currentRoomDoc = roomDocRef();
      const roomSnapshot = await getDoc(currentRoomDoc);

      if (!isMounted || !pc.current || pc.current.signalingState === 'closed') return;

      if (!roomSnapshot.exists() || !roomSnapshot.data()?.offer) {
          console.log("[WebRTC INIT CALLER] Room does not exist or no offer. Creating offer.");
          if (isMounted) setCallStatus("Creating offer...");
          try {
            const offerDescription = await pc.current.createOffer();
            await pc.current.setLocalDescription(offerDescription);
            
            const offerPayload = { type: offerDescription.type, sdp: offerDescription.sdp };
            await setDoc(currentRoomDoc, { 
              offer: offerPayload,
              participants: [userId],
              createdAt: Timestamp.now() // Use Firestore Timestamp
            }, { merge: true });
            if (isMounted) setCallStatus("Offer created. Waiting for peer...");
            console.log("[WebRTC INIT CALLER] Offer created and room doc initialized.");
          } catch (error) {
            console.error("[WebRTC INIT CALLER] Error creating offer:", error);
            if (isMounted) setCallStatus("Error: Failed to create offer.");
          }
      } else { 
        const roomData = roomSnapshot.data();
        const currentParticipants = roomData?.participants || [];
        if (!currentParticipants.includes(userId)) { 
            await updateDoc(currentRoomDoc, { participants: [...currentParticipants, userId] });
            console.log("[WebRTC INIT] Added self to participants list.");
        }
        
        if (roomData?.offer && !roomData?.answer && roomData.offer.sdp !== pc.current.localDescription?.sdp) { 
            console.log(`[WebRTC INIT CALLEE] Offer found. Current PC signalingState: ${pc.current.signalingState}`);
            if (isMounted) setCallStatus("Received offer. Processing...");
            const offerDescription = new RTCSessionDescription(roomData.offer);
            
            try {
              if (isMounted) setCallStatus("Setting remote offer description...");
              await pc.current.setRemoteDescription(offerDescription);
              if (!isMounted) return;
              console.log("[WebRTC INIT CALLEE] Successfully set remote description for offer.");

              if (isMounted) setCallStatus("Creating answer...");
              const answerDescription = await pc.current.createAnswer();
              if (!isMounted) return;
              console.log("[WebRTC INIT CALLEE] Successfully created answer object.");

              if (isMounted) setCallStatus("Setting local answer description...");
              await pc.current.setLocalDescription(answerDescription);
              if (!isMounted) return;
              console.log("[WebRTC INIT CALLEE] Successfully set local description for answer.");

              if (isMounted) setCallStatus("Sending answer to Firestore...");
              const answerPayload = { type: answerDescription.type, sdp: answerDescription.sdp };
              await updateDoc(currentRoomDoc, { answer: answerPayload });
              if (!isMounted) return;
              if (isMounted) setCallStatus("Answer sent. Connecting (ICE)...");
              console.log("[WebRTC INIT CALLEE] Answer created and sent to Firestore.");
            } catch (error:any) {
              console.error("[WebRTC INIT CALLEE] Error processing offer or creating/sending answer:", error);
              if (isMounted) setCallStatus(`Error in answer: ${String(error.message || error).substring(0,50)}`);
            }
        } else if (roomData?.offer && roomData?.answer) {
            console.log("[WebRTC INIT] Room already has offer and answer. Attempting to connect/reconnect.");
            if (isMounted) setCallStatus("Rejoining/Connecting to call...");
        }
      }
    };

    initializeMediaAndSignaling();
    
    const currentRoomDocUnsub = roomDocRef();
    const roomUnsubscribe = onSnapshot(currentRoomDocUnsub, async (snapshot) => {
      if (!isMounted || !pc.current || pc.current.signalingState === 'closed') return;
      const data = snapshot.data();
      console.log("[WebRTC LISTENER Room] Snapshot. Data:", data ? { offer: !!data.offer, answer: !!data.answer, participants: data.participants } : "No data");

      if (data?.answer && pc.current.localDescription?.type === 'offer' && 
          (!pc.current.remoteDescription || pc.current.remoteDescription.sdp !== data.answer.sdp)) {
        console.log("[WebRTC LISTENER Room] Offerer received answer. Setting remote description.");
        if (isMounted) setCallStatus("Received answer. Processing...");
        const answerDescription = new RTCSessionDescription(data.answer);
        try {
          await pc.current.setRemoteDescription(answerDescription);
          console.log("[WebRTC LISTENER Room] Offerer: Successfully set remote description for answer.");
          if (isMounted) setCallStatus("Answer processed. Connection should establish via ICE.");
        } catch (error:any) {
            console.error("[WebRTC LISTENER Room] Offerer: Error setting remote desc for answer:", error);
            if (isMounted) setCallStatus(`Error setting answer: ${String(error.message || error).substring(0,30)}`);
        }
      }
    });

    const currentOfferCandColUnsub = offerCandidatesCollectionRef();
    const offerCandidatesUnsubscribe = onSnapshot(
      query(currentOfferCandColUnsub, where("senderId", "!=", userId)), (snapshot) => {
      if (!isMounted || !pc.current || pc.current.signalingState === 'closed') return;
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          if (pc.current?.remoteDescription) { 
            console.log("[WebRTC LISTENER OfferCand] Received offerer ICE candidate (from other peer)");
            const candidate = new RTCIceCandidate(change.doc.data());
            try {
              await pc.current.addIceCandidate(candidate);
              console.log("[WebRTC LISTENER OfferCand] Added offerer ICE candidate successfully.");
            } catch (error) {
              console.error("[WebRTC LISTENER OfferCand] Error adding received ICE candidate:", error);
            }
          } else {
            console.warn("[WebRTC LISTENER OfferCand] SKIPPED adding ICE candidate: remoteDescription not yet set or pc not ready.");
          }
        }
      });
    });
    
    const currentAnswCandColUnsub = answerCandidatesCollectionRef();
    const answerCandidatesUnsubscribe = onSnapshot(
      query(currentAnswCandColUnsub, where("senderId", "!=", userId)), (snapshot) => {
      if (!isMounted || !pc.current || pc.current.signalingState === 'closed') return;
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
           if (pc.current?.remoteDescription) {
            console.log("[WebRTC LISTENER AnswerCand] Received answerer ICE candidate (from other peer)");
            const candidate = new RTCIceCandidate(change.doc.data());
            try {
              await pc.current.addIceCandidate(candidate);
              console.log("[WebRTC LISTENER AnswerCand] Added answerer ICE candidate successfully.");
            } catch (error) {
              console.error("[WebRTC LISTENER AnswerCand] Error adding received ICE candidate :", error);
            }
          } else {
             console.warn("[WebRTC LISTENER AnswerCand] SKIPPED adding ICE candidate: remoteDescription not yet set or pc not ready.");
          }
        }
      });
    });

    return () => {
      console.log("[WebRTC EFFECT] Cleanup triggered for roomId:", roomId);
      isMounted = false; 
      
      roomUnsubscribe();
      offerCandidatesUnsubscribe();
      answerCandidatesUnsubscribe();
      cleanup(); 
      console.log("[WebRTC EFFECT] Unsubscribed all listeners and called cleanup for roomId:", roomId);
    };
  }, [roomId, userId, setupPeerConnection, startLocalStream, roomDocRef, offerCandidatesCollectionRef, answerCandidatesCollectionRef]);

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

  const handleLocalHangUp = async () => {
    console.log("[WebRTC] User initiated hang up for room:", roomId);
    onHangUp(); 
  };

  const handleShareLink = async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; 
    const roomLink = `${appUrl}/meeting?roomId=${roomId}`;
    try {
      await navigator.clipboard.writeText(roomLink);
      toast({
        title: "Link Copied!",
        description: "Video call room link copied to clipboard.",
      });
    } catch (err) {
      console.error('Failed to copy room link: ', err);
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy room link to clipboard.",
      });
    }
  };

  const isLoadingStatus = callStatus.startsWith("Initializing") || 
                          callStatus.startsWith("Requesting media") || 
                          callStatus.startsWith("Setting up") || 
                          callStatus.startsWith("Checking room") || 
                          callStatus.startsWith("Creating offer") || 
                          callStatus.startsWith("Offer created") || 
                          callStatus.startsWith("Received offer") || 
                          callStatus.startsWith("Setting remote") || 
                          callStatus.startsWith("Setting local") || 
                          callStatus.startsWith("Creating answer") ||
                          callStatus.startsWith("Sending answer");

  return (
    <div className="space-y-4 p-4 border rounded-lg shadow-md bg-card">
      <p className="text-sm text-center text-muted-foreground">
        Room ID: <span className="font-semibold text-primary">{roomId}</span> | Status: {isLoadingStatus && <Loader2 className="inline h-4 w-4 animate-spin mr-1" />} {callStatus}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-center font-medium mb-2">Your Video</h3>
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-auto rounded-md bg-muted aspect-video object-cover transform scale-x-[-1]" />
        </div>
        <div>
          <h3 className="text-center font-medium mb-2">Remote Video</h3>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-auto rounded-md bg-muted aspect-video object-cover transform scale-x-[-1]" />
        </div>
      </div>
      <div className="flex justify-center space-x-2 md:space-x-3 mt-4">
        <Button onClick={handleToggleMute} variant={isMuted ? "secondary" : "outline"} size="icon" aria-label={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button onClick={handleToggleVideo} variant={isVideoOff ? "secondary" : "outline"} size="icon" aria-label={isVideoOff ? "Turn Video On" : "Turn Video Off"}>
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
        </Button>
        <Button onClick={handleShareLink} variant="outline" size="icon" aria-label="Share Room Link">
          <Share2 className="h-5 w-5" />
        </Button>
        <Button onClick={handleLocalHangUp} variant="destructive" size="icon" aria-label="Hang Up">
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default VideoCall;
