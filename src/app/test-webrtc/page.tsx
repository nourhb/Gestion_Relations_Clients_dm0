"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function TestWebRTC() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Click to test");

  const testWebRTC = async () => {
    try {
      setStatus("Testing WebRTC...");
      
      // Test 1: Media access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setStatus("✅ Media access working");
      
      // Test 2: RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      setStatus("✅ WebRTC working - Offer created");
      
      pc.close();
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.error('WebRTC test failed:', error);
      setStatus(`❌ WebRTC test failed: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WebRTC Test</h1>
      
      <Button onClick={testWebRTC} className="mb-4">
        Test WebRTC
      </Button>
      
      <p className="mb-4">{status}</p>
      
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="w-full h-auto rounded-md bg-black aspect-video" 
      />
    </div>
  );
} 