
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, addDoc, deleteDoc, Unsubscribe } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, ScreenShare, ScreenShareOff, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

export default function VideoCall({ userId, roomId, onHangUp }: VideoCallProps) {
    const { toast } = useToast();
    const isAdmin = userId === "eQwXAu9jw7cL0YtMHA3WuQznKfg1";
    console.log('[VideoCall] userId:', userId, 'isAdmin:', isAdmin);
    
    // Stable refs for connection objects and props
    const pc = useRef<RTCPeerConnection | null>(null);
    const onHangUpRef = useRef(onHangUp);
    
    // Refs for DOM elements
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // State for media streams and UI controls
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const [waitingForHost, setWaitingForHost] = useState(false);
    const [participants, setParticipants] = useState<{admin: boolean, guest: boolean}>({admin: false, guest: false});
    const [callEnded, setCallEnded] = useState(false);
    const [remoteAudioBlocked, setRemoteAudioBlocked] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string>("Initializing...");
    const [mediaError, setMediaError] = useState<string | null>(null);

    useEffect(() => {
        onHangUpRef.current = onHangUp;
    }, [onHangUp]);

    const hangUp = useCallback(async () => {
        console.log("Hanging up call");
        
        // Clean up WebRTC connection
        if (pc.current) {
            pc.current.getSenders().forEach(sender => sender.track?.stop());
            pc.current.getReceivers().forEach(receiver => receiver.track?.stop());
            if (pc.current.signalingState !== 'closed') {
                pc.current.close();
            }
            pc.current = null;
        }
        
        // Stop all media tracks
        localStream?.getTracks().forEach(track => track.stop());
        remoteStream?.getTracks().forEach(track => track.stop());

        setLocalStream(null);
        setRemoteStream(null);

        // Mark call as ended in Firestore
        const roomDocRef = doc(db, 'webrtc_sessions', roomId);
        await setDoc(roomDocRef, { ended: true }, { merge: true });

        if (onHangUpRef.current) {
            onHangUpRef.current();
        }
    }, [localStream, remoteStream, roomId]);

    const getLocalStream = useCallback(async () => {
    try {
      console.log('Requesting media permissions...');
      
      // First try with both audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });
      
      console.log('Media access granted:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));
      setLocalStream(stream);
      setMediaError(null);
      
    } catch (error: any) {
      console.warn('Failed to get audio+video, trying audio only:', error.message);
      
      try {
        // Fallback to audio only
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        
        console.log('Audio-only access granted');
        setLocalStream(audioStream);
        setMediaError('فيديو غير متاح، سيتم استخدام الصوت فقط');
        
      } catch (audioError: any) {
        console.warn('Failed to get audio, trying video only:', audioError.message);
        
        try {
          // Last resort: video only
          const videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            }
          });
          
          console.log('Video-only access granted');
          setLocalStream(videoStream);
          setMediaError('صوت غير متاح، سيتم استخدام الفيديو فقط');
          
        } catch (videoError: any) {
          console.error('All media access failed:', videoError);
          setMediaError('لا يمكن الوصول إلى الكاميرا أو الميكروفون. يرجى التحقق من الأذونات.');
          
          // Create a dummy stream to allow the call to continue
          const dummyStream = new MediaStream();
          setLocalStream(dummyStream);
        }
      }
    }
  }, []);

    // 1. Effect for acquiring local media
    useEffect(() => {
        if (localStream) return;
        
        setConnectionStatus("Requesting media access...");
        getLocalStream().then(() => {
            setConnectionStatus("Local stream ready");
        }).catch((error) => {
            console.error("Failed to get local stream:", error);
            setConnectionStatus("Media access failed");
        });
    }, [localStream, getLocalStream]);

    // Effect to set up video elements when local stream is available
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                cameraTrackRef.current = videoTrack;
            }
        }
    }, [localStream]);

    // 2. Effect for WebRTC signaling
    useEffect(() => {
        if (!localStream) {
            console.log("Waiting for local stream...");
            return;
        }

        let isComponentMounted = true;
        let roomUnsubscribe: Unsubscribe | null = null;
        let offerCandidatesUnsubscribe: Unsubscribe | null = null;
        let answerCandidatesUnsubscribe: Unsubscribe | null = null;

        const setupSignaling = async () => {
            const callDocRef = doc(db, 'webrtc_sessions', roomId);
            const callDocSnap = await getDoc(callDocRef);
            const offerDescription = callDocSnap.data()?.offer;

            if (isAdmin) {
                // Admin logic: Create offer if missing or invalid
                if (callDocSnap.exists() && (!offerDescription || !offerDescription.type || !offerDescription.sdp)) {
                    console.warn('[WebRTC] Admin detected invalid offer in existing room doc. Deleting doc to reset.');
                    await deleteDoc(callDocRef);
                }

                // Re-fetch after possible deletion
                const freshCallDocSnap = await getDoc(callDocRef);
                const freshOfferDescription = freshCallDocSnap.data()?.offer;

                if (!freshCallDocSnap.exists() || !freshOfferDescription || !freshOfferDescription.type || !freshOfferDescription.sdp) {
                    // Create offer as admin
                    setConnectionStatus("Creating offer...");
                    const peerConnection = new RTCPeerConnection(servers);
                    pc.current = peerConnection;

                    // Add local tracks
                    localStream.getTracks().forEach(track => {
                        console.log('[WebRTC] Adding local track:', track.kind);
                        peerConnection.addTrack(track, localStream);
                    });

                    // Handle remote stream
                    peerConnection.ontrack = (event) => {
                        console.log('[WebRTC] Received remote track');
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = event.streams[0];
                        }
                        setRemoteStream(event.streams[0]);
                    };

                    // Create and send offer
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    
                    try {
                        await setDoc(callDocRef, { 
                            offer: { sdp: offer.sdp, type: offer.type },
                            participants: { admin: true }
                        }, { merge: true });
                        setConnectionStatus("Offer created, waiting for answer...");
                        console.log('[WebRTC] Offer created and sent');
                    } catch (err) {
                        console.error('[WebRTC] Error creating offer:', err);
                        setConnectionStatus("Failed to create offer");
                    }

                    // Listen for answer
                    roomUnsubscribe = onSnapshot(callDocRef, snapshot => {
                        if (!isComponentMounted || !pc.current) return;
                        const data = snapshot.data();
                        if (data?.answer && !pc.current.remoteDescription) {
                            const answerDesc = new RTCSessionDescription(data.answer);
                            pc.current.setRemoteDescription(answerDesc);
                            setConnectionStatus("Answer received, connecting...");
                        }
                    });

                    // Listen for answer ICE candidates
                    answerCandidatesUnsubscribe = onSnapshot(collection(callDocRef, 'answerCandidates'), snapshot => {
                        if (!isComponentMounted || !pc.current) return;
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'added') {
                                const candidate = new RTCIceCandidate(change.doc.data());
                                pc.current?.addIceCandidate(candidate);
                            }
                        });
                    });

                } else {
                    console.log('[WebRTC] Valid offer already exists');
                    setConnectionStatus("Valid offer exists");
                }
            } else {
                // Guest logic: Wait for offer
                if (!offerDescription || !offerDescription.type || !offerDescription.sdp) {
                    setWaitingForHost(true);
                    setConnectionStatus("Waiting for host to create offer...");
                    return;
                }

                setWaitingForHost(false);
                setConnectionStatus("Processing offer...");

                // Create peer connection as guest
                const peerConnection = new RTCPeerConnection(servers);
                pc.current = peerConnection;

                // Add local tracks
                localStream.getTracks().forEach(track => {
                    console.log('[WebRTC] Adding local track:', track.kind);
                    peerConnection.addTrack(track, localStream);
                });

                // Handle remote stream
                peerConnection.ontrack = (event) => {
                    console.log('[WebRTC] Received remote track');
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                    }
                    setRemoteStream(event.streams[0]);
                };

                // Process offer and create answer
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    
                    await updateDoc(callDocRef, { 
                        answer: { sdp: answer.sdp, type: answer.type },
                        participants: { guest: true }
                    });
                    
                    setConnectionStatus("Answer sent, connecting...");
                    console.log('[WebRTC] Answer created and sent');
                } catch (error) {
                    console.error('[WebRTC] Error processing offer:', error);
                    setConnectionStatus("Failed to process offer");
                }

                // Listen for offer ICE candidates
                offerCandidatesUnsubscribe = onSnapshot(collection(callDocRef, 'offerCandidates'), snapshot => {
                    if (!isComponentMounted || !pc.current) return;
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const candidate = new RTCIceCandidate(change.doc.data());
                            pc.current?.addIceCandidate(candidate);
                        }
                    });
                });
            }

            // Set up connection state monitoring
            if (pc.current) {
                pc.current.onconnectionstatechange = () => {
                    if (!isComponentMounted || !pc.current) return;
                    console.log('[WebRTC] Connection state:', pc.current.connectionState);
                    setConnectionStatus(`Connection: ${pc.current.connectionState}`);
                    
                    if (pc.current.connectionState === 'connected') {
                        setConnectionStatus("Connected");
                    } else if (['disconnected', 'failed', 'closed'].includes(pc.current.connectionState)) {
                        setConnectionStatus("Connection lost");
                    }
                };

                pc.current.oniceconnectionstatechange = () => {
                    if (!isComponentMounted || !pc.current) return;
                    console.log('[WebRTC] ICE connection state:', pc.current.iceConnectionState);
                };
            }
        };

        setupSignaling();

        return () => {
            isComponentMounted = false;
            if (roomUnsubscribe) roomUnsubscribe();
            if (offerCandidatesUnsubscribe) offerCandidatesUnsubscribe();
            if (answerCandidatesUnsubscribe) answerCandidatesUnsubscribe();
        };
    }, [localStream, roomId, isAdmin]);

    // Track participants in Firestore
    useEffect(() => {
        const roomDocRef = doc(db, 'webrtc_sessions', roomId);
        let unsub: Unsubscribe | null = null;
        
        const updatePresence = async (present: boolean) => {
            const field = isAdmin ? 'admin' : 'guest';
            await setDoc(roomDocRef, { participants: { [field]: present } }, { merge: true });
        };
        
        updatePresence(true);
        
        unsub = onSnapshot(roomDocRef, (snap) => {
            const data = snap.data();
            if (data && data.participants) {
                setParticipants({
                    admin: !!data.participants.admin,
                    guest: !!data.participants.guest
                });
            }
        });
        
        return () => {
            updatePresence(false);
            if (unsub) unsub();
        };
    }, [roomId, isAdmin]);

    // Real-time call end detection
    useEffect(() => {
        const roomDocRef = doc(db, 'webrtc_sessions', roomId);
        const unsub = onSnapshot(roomDocRef, (snap) => {
            const data = snap.data();
            if (data && data.ended) {
                setCallEnded(true);
                setTimeout(() => {
                    if (onHangUpRef.current) onHangUpRef.current();
                }, 1000);
            }
        });
        return () => { if (unsub) unsub(); };
    }, [roomId]);

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
                setIsMuted(!track.enabled);
            });
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                if (track.label.includes('camera')) {
                    track.enabled = !track.enabled;
                    setIsVideoOff(!track.enabled);
                }
            });
        }
    };

    const toggleScreenShare = async () => {
        if (!pc.current) return;

        const videoSender = pc.current.getSenders().find(s => s.track?.kind === 'video');
        if (!videoSender) {
            toast({ variant: 'destructive', title: "خطأ", description: "تعذر العثور على مسار الفيديو لاستبداله."});
            return;
        }

        if (isScreenSharing) {
            // Stop screen sharing, switch back to camera
            if (cameraTrackRef.current) {
                await videoSender.replaceTrack(cameraTrackRef.current);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = new MediaStream([cameraTrackRef.current, ...localStream!.getAudioTracks()]);
                }
                localStream?.getVideoTracks().forEach(track => {
                    if(!track.label.includes('camera')) track.stop();
                });
                setIsScreenSharing(false);
            }
        } else {
            // Start screen sharing
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = displayStream.getVideoTracks()[0];
                if (!screenTrack) return;

                await videoSender.replaceTrack(screenTrack);
                
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = new MediaStream([screenTrack]);
                }
                
                setIsScreenSharing(true);

                // When user clicks the browser's "Stop sharing" button
                screenTrack.onended = () => {
                    if (videoSender && cameraTrackRef.current) {
                        videoSender.replaceTrack(cameraTrackRef.current!).then(() => {
                            if(localVideoRef.current) {
                                localVideoRef.current.srcObject = new MediaStream([cameraTrackRef.current!, ...localStream!.getAudioTracks()]);
                            }
                            setIsScreenSharing(false);
                        });
                    }
                };

            } catch (error) {
                console.error("Error starting screen share:", error);
                toast({ variant: 'destructive', title: "فشل مشاركة الشاشة", description: "تعذر بدء مشاركة الشاشة." });
            }
        }
    };
    
    if (waitingForHost) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <div className="text-lg font-semibold mb-2">في انتظار المضيف لبدء الجلسة...</div>
                <div className="text-muted-foreground">يرجى إبقاء هذه الصفحة مفتوحة. سيتم الانضمام تلقائيًا عند بدء الجلسة.</div>
                <div className="mt-4 text-sm text-muted-foreground">
                    <span>الحالة: </span>
                    <span>{participants.admin ? 'المضيف متصل' : 'المضيف غير متصل'} | {participants.guest ? 'الضيف متصل' : 'الضيف غير متصل'}</span>
                </div>
            </div>
        );
    }

    if (callEnded) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="text-lg font-semibold mb-2">انتهت المكالمة</div>
                <div className="text-muted-foreground">لقد غادر أحد الأطراف استشارة الفيديو.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center space-y-4 w-full">
            {mediaError && (
                <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>تنبيه</AlertTitle>
                    <AlertDescription>{mediaError}</AlertDescription>
                </Alert>
            )}
            
            <div className="text-sm text-center text-muted-foreground mb-2">
                {connectionStatus.includes("Initializing") || connectionStatus.includes("Creating") || 
                 connectionStatus.includes("Processing") || connectionStatus.includes("Waiting") ? (
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                ) : null}
                {connectionStatus}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="relative">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-lg shadow-lg bg-black aspect-video object-cover transform -scale-x-100" />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
                        أنت ({isAdmin ? 'المضيف' : 'الضيف'})
                    </div>
                </div>
                <div className="relative">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted={false}
                        className="w-full rounded-lg shadow-lg bg-black aspect-video object-cover transform -scale-x-100"
                        onPlay={() => setRemoteAudioBlocked(false)}
                        onPause={() => setRemoteAudioBlocked(true)}
                    />
                    {remoteAudioBlocked && (
                        <div
                            className="absolute inset-0 flex items-center justify-center bg-black/60 text-white cursor-pointer z-10"
                            onClick={() => {
                                if (remoteVideoRef.current) {
                                    remoteVideoRef.current.muted = false;
                                    remoteVideoRef.current.play();
                                    setRemoteAudioBlocked(false);
                                }
                            }}
                        >
                            اضغط لتفعيل الصوت
                        </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
                        {isAdmin ? 'الضيف' : 'المضيف'} {isAdmin ? (participants.guest ? '(متصل)' : '(غير متصل)') : (participants.admin ? '(متصل)' : '(غير متصل)')}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-center space-x-4">
                <Button onClick={toggleMute} variant={isMuted ? "destructive" : "secondary"} size="icon" className="rounded-full h-12 w-12">
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>
                <Button onClick={toggleVideo} variant={isVideoOff ? "destructive" : "secondary"} size="icon" className="rounded-full h-12 w-12" disabled={isScreenSharing}>
                    {isVideoOff ? <VideoOff /> : <VideoIcon />}
                </Button>
                {isMobileDevice() ? (
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="rounded-full h-12 w-12 opacity-50 cursor-not-allowed"
                        onClick={() => toast({ title: "غير مدعوم", description: "مشاركة الشاشة غير مدعومة على الجوال." })}
                        disabled
                    >
                        <ScreenShareOff />
                    </Button>
                ) : (
                    <Button onClick={toggleScreenShare} variant={isScreenSharing ? "default" : "secondary"} size="icon" className="rounded-full h-12 w-12">
                        {isScreenSharing ? <ScreenShareOff /> : <ScreenShare />}
                    </Button>
                )}
                <Button onClick={hangUp} variant="destructive" size="icon" className="rounded-full h-16 w-16">
                    <PhoneOff />
                </Button>
            </div>
        </div>
    );
}
