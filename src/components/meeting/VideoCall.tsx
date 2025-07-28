
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
  const remoteStreamSet = useRef(false);
  const callStarted = useRef(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState("Starting...");
  const [isHost, setIsHost] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const { toast } = useToast();

  const roomRef = doc(db, 'simple_rooms', roomId);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ]
  };

  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  const getLocalStream = async () => {
    try {
      addDebugInfo("Requesting camera and microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStream.current = stream;
      addDebugInfo(`Got local stream with ${stream.getTracks().length} tracks`);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        addDebugInfo("Local video element set");
        
        // Debug local video element state
        const video = localVideoRef.current;
        addDebugInfo(`Local video readyState: ${video.readyState}`);
        addDebugInfo(`Local video paused: ${video.paused}`);
        addDebugInfo(`Local video muted: ${video.muted}`);
        
        // Check if local video is actually playing
        video.onloadedmetadata = () => {
          addDebugInfo("Local video metadata loaded");
        };
        
        video.oncanplay = () => {
          addDebugInfo("Local video can play");
        };
        
        video.onplay = () => {
          addDebugInfo("Local video started playing");
        };
        
        video.onerror = (e) => {
          addDebugInfo(`Local video error: ${e}`);
        };
        
        // Force play the local video
        video.play().then(() => {
          addDebugInfo("Local video play() successful");
        }).catch(err => {
          addDebugInfo(`Local video play() failed: ${err}`);
        });
      }
      
      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      addDebugInfo(`Media error: ${error}`);
      toast({
        variant: "destructive",
        title: "Media Error",
        description: "Could not access camera or microphone",
      });
      return null;
    }
  };

  const createPeerConnection = () => {
    addDebugInfo("Creating peer connection...");
    peerConnection.current = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, localStream.current!);
        addDebugInfo(`Added ${track.kind} track to peer connection`);
      });
    }

    // Handle remote stream
    peerConnection.current.ontrack = (event) => {
      addDebugInfo("Remote stream received!");
      
      // Only set remote stream once
      if (remoteStreamSet.current) {
        addDebugInfo("Remote stream already set, skipping...");
        return;
      }
      
      // Additional check: if remote video already has a stream, don't set it again
      if (remoteVideoRef.current?.srcObject) {
        addDebugInfo("Remote video already has srcObject, skipping...");
        return;
      }
      
      if (remoteVideoRef.current && event.streams[0]) {
        remoteStreamSet.current = true;
        remoteVideoRef.current.srcObject = event.streams[0];
        setStatus("Connected!");
        addDebugInfo("Remote video element set");
        
        // Debug video element state
        const video = remoteVideoRef.current;
        addDebugInfo(`Remote video readyState: ${video.readyState}`);
        addDebugInfo(`Remote video paused: ${video.paused}`);
        addDebugInfo(`Remote video muted: ${video.muted}`);
        addDebugInfo(`Remote video volume: ${video.volume}`);
        
        // Check if video is actually playing
        video.onloadedmetadata = () => {
          addDebugInfo("Remote video metadata loaded");
        };
        
        video.oncanplay = () => {
          addDebugInfo("Remote video can play");
        };
        
        video.onplay = () => {
          addDebugInfo("Remote video started playing");
        };
        
        video.onerror = (e) => {
          addDebugInfo(`Remote video error: ${e}`);
        };
        
        // Force play the video
        video.play().then(() => {
          addDebugInfo("Remote video play() successful");
        }).catch(err => {
          addDebugInfo(`Remote video play() failed: ${err}`);
        });
        
        // Debug stream tracks
        event.streams[0].getTracks().forEach(track => {
          addDebugInfo(`Remote ${track.kind} track enabled: ${track.enabled}, readyState: ${track.readyState}`);
        });
      }
    };

    // Handle ICE candidates
    peerConnection.current.onicecandidate = async (event) => {
      if (event.candidate) {
        addDebugInfo("ICE candidate generated");
        try {
          await addDoc(collection(roomRef, 'candidates'), {
            candidate: event.candidate.toJSON(),
            from: isHost ? 'host' : 'guest'
          });
          addDebugInfo("ICE candidate sent to Firestore");
        } catch (error) {
          addDebugInfo(`Failed to send ICE candidate: ${error}`);
        }
      }
    };

    // Handle connection state
    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current) {
        addDebugInfo(`Connection state: ${peerConnection.current.connectionState}`);
        setStatus(`Connection: ${peerConnection.current.connectionState}`);
        
        if (peerConnection.current.connectionState === 'connected') {
          addDebugInfo("🎉 WebRTC connection established successfully!");
        } else if (peerConnection.current.connectionState === 'failed') {
          addDebugInfo("❌ WebRTC connection failed");
        }
      }
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      if (peerConnection.current) {
        addDebugInfo(`ICE connection state: ${peerConnection.current.iceConnectionState}`);
        
        if (peerConnection.current.iceConnectionState === 'connected') {
          addDebugInfo("🎉 ICE connection established!");
        } else if (peerConnection.current.iceConnectionState === 'failed') {
          addDebugInfo("❌ ICE connection failed");
        }
      }
    };
    
    peerConnection.current.onicegatheringstatechange = () => {
      if (peerConnection.current) {
        addDebugInfo(`ICE gathering state: ${peerConnection.current.iceGatheringState}`);
      }
    };
    
    peerConnection.current.onsignalingstatechange = () => {
      if (peerConnection.current) {
        addDebugInfo(`Signaling state: ${peerConnection.current.signalingState}`);
      }
    };
  };

  const startCall = async () => {
    if (callStarted.current) {
      addDebugInfo("Call already started, skipping...");
      return;
    }
    
    callStarted.current = true;
    setStatus("Getting camera and microphone...");
    remoteStreamSet.current = false; // Reset flag for new call
    const stream = await getLocalStream();
    if (!stream) return;

    setStatus("Setting up connection...");
    createPeerConnection();

    // Check if room exists
    try {
      addDebugInfo("Checking if room exists...");
      const roomSnapshot = await getDoc(roomRef);
      
      if (!roomSnapshot.exists()) {
        // Create new room (host)
        setIsHost(true);
        setStatus("Creating call...");
        addDebugInfo("Room doesn't exist, creating as host");
        
        const offer = await peerConnection.current!.createOffer();
        await peerConnection.current!.setLocalDescription(offer);
        addDebugInfo("Offer created and set as local description");
        
        await setDoc(roomRef, {
          offer: offer,
          host: userId,
          created: new Date().toISOString()
        });
        addDebugInfo("Room document created with offer");
        
        setStatus("Waiting for someone to join...");
      } else {
        // Join existing room (guest)
        setIsHost(false);
        setStatus("Joining call...");
        addDebugInfo("Room exists, joining as guest");
        
        const offerData = roomSnapshot.data()?.offer;
        if (offerData) {
          await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offerData));
          addDebugInfo("Remote description set from offer");
          
          const answer = await peerConnection.current!.createAnswer();
          await peerConnection.current!.setLocalDescription(answer);
          addDebugInfo("Answer created and set as local description");
          
          await setDoc(roomRef, {
            answer: answer,
            guest: userId,
            joined: new Date().toISOString()
          }, { merge: true });
          addDebugInfo("Answer sent to Firestore");
          
          setStatus("Joined call");
        }
      }
    } catch (error) {
      addDebugInfo(`Error in startCall: ${error}`);
      setStatus("Error starting call");
    }
  };

  useEffect(() => {
    addDebugInfo("VideoCall component mounted");
    startCall();

    // Listen for answer (if host)
    const unsubscribeRoom = onSnapshot(roomRef, async (snapshot) => {
      if (!snapshot.exists() || !peerConnection.current) return;
      
      const data = snapshot.data();
      addDebugInfo(`Room document updated: ${Object.keys(data).join(', ')}`);
      
      if (isHost && data.answer && !peerConnection.current.remoteDescription) {
        setStatus("Connecting...");
        addDebugInfo("Received answer, setting remote description");
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    // Listen for ICE candidates
    const unsubscribeCandidates = onSnapshot(collection(roomRef, 'candidates'), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' && peerConnection.current?.remoteDescription) {
          const candidateData = change.doc.data();
          const from = candidateData.from;
          
          // Only add candidates from the other peer
          if ((isHost && from === 'guest') || (!isHost && from === 'host')) {
            addDebugInfo(`Adding ICE candidate from ${from}`);
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
          }
        }
      });
    });

    return () => {
      addDebugInfo("VideoCall component unmounting");
      remoteStreamSet.current = false;
      callStarted.current = false;
      unsubscribeRoom();
      unsubscribeCandidates();
      
      if (peerConnection.current) {
        peerConnection.current.close();
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
          Room: {roomId} | {isHost ? 'Host' : 'Guest'} | {status}
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

      {/* Debug Info */}
      <div className="mt-4 p-2 bg-gray-100 rounded text-xs max-h-32 overflow-y-auto">
        <h4 className="font-bold mb-1">Debug Info:</h4>
        {debugInfo.map((info, index) => (
          <div key={index} className="text-gray-600">{info}</div>
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
