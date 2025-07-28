"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function TestWebRTC() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Click to test");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${timestamp}: ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const testWebRTC = async () => {
    try {
      setStatus("Testing WebRTC...");
      setLogs([]);
      
      // Test 1: Check WebRTC support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("WebRTC not supported in this browser");
      }
      addLog("✅ WebRTC API supported");
      
      // Test 2: Media access
      addLog("Requesting camera and microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      addLog(`✅ Got stream with ${stream.getTracks().length} tracks`);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        addLog("✅ Local video playing");
      }
      
      // Test 3: RTCPeerConnection
      addLog("Creating RTCPeerConnection...");
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        addLog(`✅ Added ${track.kind} track`);
      });
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog("✅ Offer created successfully");
      
      // Test 4: Check connection state
      pc.onconnectionstatechange = () => {
        addLog(`Connection state: ${pc.connectionState}`);
      };
      
      pc.oniceconnectionstatechange = () => {
        addLog(`ICE connection state: ${pc.iceConnectionState}`);
      };
      
      pc.onicegatheringstatechange = () => {
        addLog(`ICE gathering state: ${pc.iceGatheringState}`);
      };
      
      // Clean up
      setTimeout(() => {
        pc.close();
        stream.getTracks().forEach(track => track.stop());
        addLog("✅ Test completed successfully");
        setStatus("✅ All tests passed!");
      }, 2000);
      
    } catch (error) {
      console.error('WebRTC test failed:', error);
      addLog(`❌ Test failed: ${error}`);
      setStatus(`❌ Test failed: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WebRTC Compatibility Test</h1>
      
      <Button onClick={testWebRTC} className="mb-4">
        Run WebRTC Test
      </Button>
      
      <p className="mb-4 font-semibold">{status}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Local Video Test:</h3>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-auto rounded-md bg-black aspect-video" 
          />
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Test Logs:</h3>
          <div className="bg-gray-100 p-3 rounded text-xs max-h-64 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Browser Information:</h3>
        <p><strong>User Agent:</strong> {navigator.userAgent}</p>
        <p><strong>WebRTC Support:</strong> {navigator.mediaDevices ? '✅ Supported' : '❌ Not Supported'}</p>
        <p><strong>getUserMedia Support:</strong> {navigator.mediaDevices?.getUserMedia ? '✅ Supported' : '❌ Not Supported'}</p>
        <p><strong>RTCPeerConnection Support:</strong> {typeof RTCPeerConnection !== 'undefined' ? '✅ Supported' : '❌ Not Supported'}</p>
      </div>
    </div>
  );
} 