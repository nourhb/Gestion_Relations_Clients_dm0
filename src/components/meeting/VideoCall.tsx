
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, addDoc, getDocs, writeBatch, deleteDoc, DocumentData, arrayUnion, Unsubscribe } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, ScreenShare, ScreenShareOff, Loader2 } from 'lucide-react';
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

export default function VideoCall({ userId, roomId, onHangUp }: VideoCallProps) {
    const { toast } = useToast();
    
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
    const [retryCount, setRetryCount] = useState(0);
    const [participants, setParticipants] = useState<{admin: boolean, guest: boolean}>({admin: false, guest: false});
    const isAdmin = userId === "eQwXAu9jw7cL0YtMHA3WuQznKfg1";

    useEffect(() => {
        onHangUpRef.current = onHangUp;
    }, [onHangUp]);

    const hangUp = useCallback(async () => {
        console.log("Hanging up call");
        if (pc.current) {
            pc.current.getSenders().forEach(sender => sender.track?.stop());
            pc.current.getReceivers().forEach(receiver => receiver.track?.stop());
            if (pc.current.signalingState !== 'closed') {
                pc.current.close();
            }
        }
        
        localStream?.getTracks().forEach(track => track.stop());
        remoteStream?.getTracks().forEach(track => track.stop());

        setLocalStream(null);
        setRemoteStream(null);

        // Optionally clean up Firestore document, though might be good to keep for logs
        // Be careful with this, as the other user might still be connected.
        // A better approach is a "leave" signal rather than deleting the doc.
        
        if (onHangUpRef.current) {
            onHangUpRef.current();
        }

    }, [localStream, remoteStream]);


    // 1. Effect for acquiring local media
    useEffect(() => {
        let stream: MediaStream;
        let isComponentMounted = true;

        const getMedia = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if(isComponentMounted) {
                    setLocalStream(stream);
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                    cameraTrackRef.current = stream.getVideoTracks()[0] || null;
                } else {
                    // component unmounted before stream was ready
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (error) {
                console.error("Error accessing media devices.", error);
                toast({
                    variant: 'destructive',
                    title: 'خطأ في الوسائط',
                    description: 'تعذر الوصول إلى الكاميرا أو الميكروفون. يرجى التحقق من الأذونات.'
                });
                if (onHangUpRef.current) onHangUpRef.current();
            }
        };

        getMedia();

        return () => {
            isComponentMounted = false;
            // Cleanup media stream when component unmounts
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [toast]);

    // 2. Effect for WebRTC signaling, depends on localStream
    useEffect(() => {
        if (!localStream) {
            console.log("Waiting for local stream...");
            return;
        }
        let cancelled = false;
        let retryTimeout: NodeJS.Timeout | null = null;
        const setupSignaling = async () => {
            const callDocRef = doc(db, 'webrtc_sessions', roomId);
            const callDocSnap = await getDoc(callDocRef);
            if (!callDocSnap.exists() && !isAdmin) {
                setWaitingForHost(true);
                retryTimeout = setTimeout(() => setRetryCount(c => c + 1), 3000);
                return;
            }
            setWaitingForHost(false);

            console.log("Local stream is ready, starting WebRTC setup for room:", roomId);
            
            const peerConnection = new RTCPeerConnection(servers);
            pc.current = peerConnection;

            // Add local tracks to the peer connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Setup remote stream
            const remoteMediaStream = new MediaStream();
            setRemoteStream(remoteMediaStream);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteMediaStream;
            }

            peerConnection.ontrack = (event) => {
                event.streams[0].getTracks().forEach(track => {
                    remoteMediaStream.addTrack(track);
                });
            };

            const offerCandidatesCol = collection(callDocRef, 'offerCandidates');
            const answerCandidatesCol = collection(callDocRef, 'answerCandidates');
            
            let callUnsubscribe: Unsubscribe | null = null;
            let offerCandidatesUnsubscribe: Unsubscribe | null = null;
            let answerCandidatesUnsubscribe: Unsubscribe | null = null;
            let queuedAnswerCandidates: RTCIceCandidateInit[] = [];
            let queuedOfferCandidates: RTCIceCandidateInit[] = [];


            if (!callDocSnap.exists()) {
                // Caller logic (admin)
                peerConnection.onicecandidate = event => {
                    if (event.candidate) addDoc(offerCandidatesCol, event.candidate.toJSON());
                };

                const offerDescription = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offerDescription);
                await setDoc(callDocRef, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });

                callUnsubscribe = onSnapshot(callDocRef, snapshot => {
                    const data = snapshot.data();
                    if (!peerConnection.currentRemoteDescription && data?.answer) {
                        const answerDescription = new RTCSessionDescription(data.answer);
                        peerConnection.setRemoteDescription(answerDescription).then(() => {
                            queuedAnswerCandidates.forEach(candidate => peerConnection.addIceCandidate(new RTCIceCandidate(candidate)));
                            queuedAnswerCandidates = [];
                        });
                    }
                });

                answerCandidatesUnsubscribe = onSnapshot(answerCandidatesCol, snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const candidate = change.doc.data();
                            if(peerConnection.currentRemoteDescription) {
                                peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                            } else {
                                queuedAnswerCandidates.push(candidate);
                            }
                        }
                    });
                });

            } else {
                // Callee logic (guest)
                peerConnection.onicecandidate = event => {
                    if (event.candidate) addDoc(answerCandidatesCol, event.candidate.toJSON());
                };

                const offerDescription = callDocSnap.data().offer;
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription));
                
                const answerDescription = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answerDescription);

                await updateDoc(callDocRef, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });

                offerCandidatesUnsubscribe = onSnapshot(offerCandidatesCol, snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                        }
                    });
                });
            }
        };
        setupSignaling();
        return () => {
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [localStream, roomId, userId, toast, retryCount]);

    // Track participants in Firestore
    useEffect(() => {
        const roomDocRef = doc(db, 'webrtc_sessions', roomId);
        let unsub: Unsubscribe | null = null;
        let left = false;
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
            left = true;
            updatePresence(false);
            if (unsub) unsub();
        };
    }, [roomId, isAdmin]);

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
                if (track.label.includes('camera')) { // only toggle the camera track
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
                
                // Update local video to show screen share
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

    return (
        <div className="flex flex-col items-center space-y-4 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="relative">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-lg shadow-lg bg-black aspect-video object-cover transform -scale-x-100" />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
                        أنت ({isAdmin ? 'المضيف' : 'الضيف'})
                    </div>
                </div>
                <div className="relative">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-lg shadow-lg bg-black aspect-video object-cover transform -scale-x-100" />
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
                <Button onClick={toggleScreenShare} variant={isScreenSharing ? "default" : "secondary"} size="icon" className="rounded-full h-12 w-12">
                    {isScreenSharing ? <ScreenShareOff /> : <ScreenShare />}
                </Button>
                <Button onClick={hangUp} variant="destructive" size="icon" className="rounded-full h-16 w-16">
                    <PhoneOff />
                </Button>
            </div>
        </div>
    );
}
