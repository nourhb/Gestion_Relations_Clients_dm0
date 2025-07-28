
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState("Starting...");
  const [isHost, setIsHost] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const { toast } = useToast();

  const roomRef = doc(db, 'calls', roomId);
  const offerCandidatesRef = collection(roomRef, 'offerCandidates');
  const answerCandidatesRef = collection(roomRef, 'answerCandidates');

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('Local video stream set');
      }
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        variant: "destructive",
        title: "Media Error",
        description: "Could not access camera or microphone",
      });
      return null;
    }
  };

  const createPeerConnection = () => {
    pc.current = new RTCPeerConnection(configuration);

    pc.current.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0]);
      remoteStream.current = event.streams[0];
      setHasRemoteStream(true);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log('Remote video element srcObject set');
        
        // Force play the video
        remoteVideoRef.current.play().then(() => {
          console.log('Remote video playing successfully');
        }).catch(err => {
          console.error('Error playing remote video:', err);
        });
      } else {
        console.error('Remote video ref is null');
      }
    };

    pc.current.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateCollection = isHost ? offerCandidatesRef : answerCandidatesRef;
        await addDoc(candidateCollection, event.candidate.toJSON());
        console.log('ICE candidate sent');
      }
    };

    pc.current.onconnectionstatechange = () => {
      if (pc.current) {
        console.log('Connection state:', pc.current.connectionState);
        setStatus(`Connection: ${pc.current.connectionState}`);
      }
    };

    pc.current.oniceconnectionstatechange = () => {
      if (pc.current) {
        console.log('ICE connection state:', pc.current.iceConnectionState);
      }
    };
  };

  const startCall = async () => {
    setStatus("Getting media...");
    const stream = await getMedia();
    if (!stream) return;

    setStatus("Creating connection...");
    createPeerConnection();

    if (!pc.current) return;

    // Add local tracks to peer connection
    stream.getTracks().forEach(track => {
      pc.current?.addTrack(track, stream);
      console.log('Added track to peer connection:', track.kind);
    });

    // Check if room exists
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      // Create room and offer
      setIsHost(true);
      setStatus("Creating offer...");
      
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      
      await setDoc(roomRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
      
      setStatus("Waiting for answer...");
      console.log('Offer created and sent');
    } else {
      // Join existing room
      setIsHost(false);
      setStatus("Processing offer...");
      
      const offer = roomDoc.data()?.offer;
      if (offer) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Remote description set');
        
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        
        await setDoc(roomRef, {
          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        }, { merge: true });
        
        setStatus("Answer sent...");
        console.log('Answer created and sent');
      }
    }
  };

  useEffect(() => {
    startCall();

    // Listen for answer (if host)
    const unsubscribeRoom = onSnapshot(roomRef, async (doc) => {
      if (!doc.exists() || !pc.current) return;
      
      const data = doc.data();
      
      if (isHost && data.answer && !pc.current.remoteDescription) {
        setStatus("Received answer...");
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('Answer received and set');
      }
    });

    // Listen for ICE candidates
    const unsubscribeOfferCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
      if (!isHost) {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && pc.current?.remoteDescription) {
            await pc.current.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            console.log('Added offer ICE candidate');
          }
        });
      }
    });

    const unsubscribeAnswerCandidates = onSnapshot(answerCandidatesRef, (snapshot) => {
      if (isHost) {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && pc.current?.remoteDescription) {
            await pc.current.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            console.log('Added answer ICE candidate');
          }
        });
      }
    });

    return () => {
      unsubscribeRoom();
      unsubscribeOfferCandidates();
      unsubscribeAnswerCandidates();
      
      if (pc.current) {
        pc.current.close();
      }
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, isHost]);

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
    if (pc.current) {
      pc.current.close();
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
          Room: {roomId} | {isHost ? 'Host' : 'Guest'} | {status}
          {status.includes('Starting') || status.includes('Getting') || status.includes('Creating') || status.includes('Processing') || status.includes('Waiting') || status.includes('Received') && <Loader2 className="inline h-4 w-4 animate-spin ml-2" />}
        </p>
        {hasRemoteStream && (
          <p className="text-sm text-green-600">Remote stream connected!</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-center font-medium mb-2">You</h3>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-auto rounded-md bg-black aspect-video object-cover transform scale-x-[-1]" 
          />
        </div>
        <div>
          <h3 className="text-center font-medium mb-2">
            Remote User {hasRemoteStream ? '(Connected)' : '(Waiting...)'}
          </h3>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-auto rounded-md bg-black aspect-video object-cover transform scale-x-[-1]" 
            onLoadedMetadata={() => console.log('Remote video metadata loaded')}
            onCanPlay={() => console.log('Remote video can play')}
            onPlay={() => console.log('Remote video started playing')}
            onError={(e) => console.error('Remote video error:', e)}
          />
          {!hasRemoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white rounded-md">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Waiting for remote user...</p>
              </div>
            </div>
          )}
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
