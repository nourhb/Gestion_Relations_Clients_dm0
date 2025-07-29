
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, getDoc, deleteDoc } from 'firebase/firestore';
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
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const { toast } = useToast();

  const roomRef = doc(db, 'rooms', roomId);

  const getMediaStream = async () => {
    try {
      // Stop any existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Got media stream with tracks:', stream.getTracks().map(t => t.kind));
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        
        // Ensure video plays
        const playPromise = localVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('Local video playing successfully');
          }).catch(error => {
            console.error('Local video play failed:', error);
            // Retry playing the video
            setTimeout(() => {
              localVideoRef.current?.play().catch(console.error);
            }, 1000);
          });
        }

        // Add event listeners to keep video alive
        localVideoRef.current.onended = () => {
          console.log('Local video ended, restarting...');
          localVideoRef.current?.play().catch(console.error);
        };

        localVideoRef.current.onpause = () => {
          console.log('Local video paused, resuming...');
          localVideoRef.current?.play().catch(console.error);
        };

        localVideoRef.current.onerror = () => {
          console.log('Local video error, restarting stream...');
          getMediaStream();
        };
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

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
        console.log(`Added ${track.kind} track to peer connection`);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Remote track received:', event.streams[0]);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('Remote video playing successfully');
            setStatus("Connected!");
            
            // Add event listeners to keep remote video alive
            remoteVideoRef.current!.onended = () => {
              console.log('Remote video ended, restarting...');
              remoteVideoRef.current?.play().catch(console.error);
            };

            remoteVideoRef.current!.onpause = () => {
              console.log('Remote video paused, resuming...');
              remoteVideoRef.current?.play().catch(console.error);
            };

            remoteVideoRef.current!.onerror = () => {
              console.log('Remote video error, attempting to restart...');
              remoteVideoRef.current?.play().catch(console.error);
            };
          }).catch(error => {
            console.error('Remote video play failed:', error);
            // Retry playing remote video
            setTimeout(() => {
              remoteVideoRef.current?.play().catch(console.error);
            }, 1000);
          });
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        setDoc(roomRef, {
          iceCandidate: event.candidate.toJSON(),
          from: userId,
          timestamp: Date.now()
        }, { merge: true }).catch(err => {
          console.error('Failed to save ICE candidate:', err);
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setStatus(`Connection: ${pc.connectionState}`);
      
      if (pc.connectionState === 'failed') {
        console.log('Connection failed, attempting retry...');
        setTimeout(() => {
          if (connectionAttempts < 3) {
            setConnectionAttempts(prev => prev + 1);
            startCall();
          }
        }, 2000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    console.log('=== STARTING CALL ===');
    setStatus("Getting media...");
    const stream = await getMediaStream();
    if (!stream) return;

    setStatus("Setting up connection...");
    const pc = createPeerConnection();

    // Check if room exists
    console.log('Checking if room exists...');
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      // Create room as host
      console.log('Creating room as host...');
      setIsHost(true);
      setStatus("Creating call...");
      
      const offer = await pc.createOffer();
      console.log('Offer created:', offer);
      await pc.setLocalDescription(offer);
      console.log('Local description set');
      
      await setDoc(roomRef, {
        offer: offer,
        host: userId,
        timestamp: Date.now()
      });
      console.log('Room document created with offer');
      
      setStatus("Waiting for someone to join...");
    } else {
      // Join as guest
      console.log('Joining room as guest...');
      setIsHost(false);
      setStatus("Joining call...");
      
      const data = roomDoc.data();
      console.log('Room data:', data);
      if (data.offer) {
        console.log('Setting remote description from offer...');
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('Remote description set');
        
        const answer = await pc.createAnswer();
        console.log('Answer created:', answer);
        await pc.setLocalDescription(answer);
        console.log('Local description set');
        
        await setDoc(roomRef, {
          answer: answer,
          guest: userId,
          timestamp: Date.now()
        }, { merge: true });
        console.log('Answer sent to Firestore');
        
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
      console.log('=== ROOM UPDATE ===', data);
      
      // Handle answer (for host)
      if (isHost && data.answer && !peerConnectionRef.current.remoteDescription) {
        console.log('Host: Received answer, setting remote description...');
        setStatus("Connecting...");
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('Host: Remote description set successfully');
        } catch (error) {
          console.error('Host: Failed to set remote description:', error);
        }
      }
      
      // Handle offer (for guest)
      if (!isHost && data.offer && !peerConnectionRef.current.remoteDescription) {
        console.log('Guest: Received offer, setting remote description...');
        setStatus("Connecting...");
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          console.log('Guest: Remote description set');
          
          const answer = await peerConnectionRef.current.createAnswer();
          console.log('Guest: Answer created:', answer);
          await peerConnectionRef.current.setLocalDescription(answer);
          console.log('Guest: Local description set');
          
          await setDoc(roomRef, {
            answer: answer,
            guest: userId,
            timestamp: Date.now()
          }, { merge: true });
          console.log('Guest: Answer sent to Firestore');
        } catch (error) {
          console.error('Guest: Failed to handle offer:', error);
        }
      }
      
      // Handle ICE candidates
      if (data.iceCandidate && data.from !== userId && peerConnectionRef.current.remoteDescription) {
        console.log('Adding ICE candidate:', data.iceCandidate);
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.iceCandidate));
          console.log('ICE candidate added successfully');
        } catch (error) {
          console.error('Failed to add ICE candidate:', error);
        }
      }
    });

    // Periodic stream health check
    const streamHealthCheck = setInterval(() => {
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        const videoTrack = tracks.find(track => track.kind === 'video');
        const audioTrack = tracks.find(track => track.kind === 'audio');
        
        // Check if tracks are still active
        if (videoTrack && videoTrack.readyState === 'ended') {
          console.log('Video track ended, restarting stream...');
          getMediaStream();
        }
        
        if (audioTrack && audioTrack.readyState === 'ended') {
          console.log('Audio track ended, restarting stream...');
          getMediaStream();
        }
        
        // Check if video element is playing
        if (localVideoRef.current && localVideoRef.current.paused) {
          console.log('Local video is paused, restarting...');
          localVideoRef.current.play().catch(console.error);
        }
      }
      
      // Check remote video
      if (remoteVideoRef.current && remoteVideoRef.current.paused && remoteVideoRef.current.srcObject) {
        console.log('Remote video is paused, restarting...');
        remoteVideoRef.current.play().catch(console.error);
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(streamHealthCheck);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, isHost, userId, connectionAttempts]);

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

  const handleHangUp = async () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Clean up room
    try {
      await deleteDoc(roomRef);
    } catch (error) {
      console.error('Failed to delete room:', error);
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
          {connectionAttempts > 0 && <span className="ml-2 text-orange-600">(Attempt {connectionAttempts + 1})</span>}
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
