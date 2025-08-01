"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import GoogleMeetBooking from '@/components/meeting/GoogleMeetBooking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Users, Copy, RefreshCw, ArrowLeft, Settings, Shield, Clock, CheckCircle, AlertCircle, Share2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';



const MeetingPageContent = () => {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [meetLink, setMeetLink] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [serviceRequestId, setServiceRequestId] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);

  // Check for service request ID, meet link, or room ID in URL params
  useEffect(() => {
    const urlServiceRequestId = searchParams.get('serviceRequestId');
    const urlMeetLink = searchParams.get('meetLink');
    const urlRoomId = searchParams.get('roomId');
    
    if (urlServiceRequestId) {
      setServiceRequestId(urlServiceRequestId);
      setShowBookingForm(true);
    }
    
    if (urlMeetLink) {
      setMeetLink(decodeURIComponent(urlMeetLink));
      setBookingComplete(true);
    }
    
    if (urlRoomId) {
      // Handle custom meeting room
      setMeetLink(`Meeting Room: ${urlRoomId}`);
      setBookingComplete(true);
    }
  }, [searchParams]);

  const handleBookingComplete = (googleMeetLink: string) => {
    setMeetLink(googleMeetLink);
    setBookingComplete(true);
    setShowBookingForm(false);
    toast({
      title: "Booking Confirmed!",
      description: "Your Google Meet consultation has been scheduled successfully.",
    });
  };

  const handleStartBooking = () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to book a consultation",
      });
      return;
    }
    setShowBookingForm(true);
  };

  const handleJoinMeeting = () => {
    if (meetLink) {
      if (meetLink.startsWith('Meeting Room:')) {
        // For custom meetings, just show a success message
        toast({
          title: 'Meeting Room Joined!',
          description: 'You are now in the meeting room. The consultation will begin shortly.',
        });
      } else if (meetLink.startsWith('https://meet.jit.si/')) {
        // For Jitsi Meet links, open in new tab
        window.open(meetLink, '_blank');
      } else if (meetLink.startsWith('https://')) {
        // For other external links (Google Meet), open in new tab
        window.open(meetLink, '_blank');
      }
    }
  };

  const handleCopyMeetLink = () => {
    if (meetLink) {
      const textToCopy = meetLink.startsWith('Meeting Room:') 
        ? `Meeting Room: ${meetLink.replace('Meeting Room: ', '')}`
        : meetLink;
      
      navigator.clipboard.writeText(textToCopy).then(() => {
        toast({
          title: 'Meeting info copied!',
          description: meetLink.startsWith('Meeting Room:') 
            ? 'Meeting room information has been copied to clipboard.'
            : meetLink.startsWith('https://meet.jit.si/')
            ? 'Jitsi Meet link has been copied to clipboard.'
            : 'Google Meet link has been copied to clipboard.'
        });
      }).catch(() => {
        toast({
          variant: 'destructive',
          title: 'Copy Failed',
          description: 'Failed to copy meeting information. Please try again.'
        });
      });
    }
  };

  const handleShareMeetLink = () => {
    if (meetLink) {
      const isCustomMeeting = meetLink.startsWith('Meeting Room:');
      const isJitsiMeet = meetLink.startsWith('https://meet.jit.si/');
      const shareText = isCustomMeeting 
        ? `Join my consultation meeting room: ${meetLink}`
        : isJitsiMeet
        ? `Join my Jitsi Meet consultation: ${meetLink}`
        : `Join my Google Meet consultation: ${meetLink}`;
      
      if (navigator.share) {
        navigator.share({
          title: isCustomMeeting ? 'Consultation Meeting' : isJitsiMeet ? 'Jitsi Meet Consultation' : 'Google Meet Consultation',
          text: shareText,
          url: isCustomMeeting ? window.location.href : meetLink
        });
      } else {
        navigator.clipboard.writeText(shareText).then(() => {
          toast({
            title: 'Meeting info copied!',
            description: isCustomMeeting 
              ? 'Meeting room information has been copied to clipboard.'
              : isJitsiMeet
              ? 'Jitsi Meet link has been copied to clipboard.'
              : 'Meet link has been copied to clipboard.'
          });
        });
      }
    }
  };

  // Show booking form if requested
  if (showBookingForm && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBookingForm(false)}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <GoogleMeetBooking
            serviceRequestId={serviceRequestId || `req_${Date.now()}`}
            userId={user.uid}
            userName={user.displayName || user.email || 'User'}
            userEmail={user.email || ''}
            onBookingComplete={handleBookingComplete}
          />
        </div>
      </div>
    );
  }

  // Show meeting details if booking is complete
  if (bookingComplete && meetLink) {
    const isCustomMeeting = meetLink.startsWith('Meeting Room:');
    const isJitsiMeet = meetLink.startsWith('https://meet.jit.si/');
    const isGoogleMeet = meetLink.startsWith('https://meet.google.com/');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>
              {isCustomMeeting ? 'Meeting Room Ready!' : isJitsiMeet ? 'Jitsi Meet Ready!' : 'Consultation Scheduled!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground">
              {isCustomMeeting 
                ? 'Your meeting room is ready. You can join the consultation using the information below.'
                : isJitsiMeet
                ? 'Your Jitsi Meet consultation has been successfully scheduled. You can join the meeting using the link below.'
                : 'Your Google Meet consultation has been successfully scheduled. You can join the meeting using the link below.'
              }
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {isCustomMeeting ? 'Meeting Room:' : isJitsiMeet ? 'Jitsi Meet Link:' : 'Google Meet Link:'}
              </p>
              <div className="flex items-center space-x-2">
                <Input 
                  value={isCustomMeeting ? meetLink.replace('Meeting Room: ', '') : meetLink} 
                  readOnly 
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMeetLink}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <Button 
                onClick={handleJoinMeeting}
                className="w-full"
                size="lg"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {isCustomMeeting ? 'Join Meeting Room' : isJitsiMeet ? 'Join Jitsi Meet' : 'Join Google Meet'}
              </Button>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={handleShareMeetLink}
                  className="flex-1"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setBookingComplete(false);
                    setMeetLink('');
                  }}
                  className="flex-1"
                >
                  Book Another
                </Button>
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-1">Important Notes:</p>
              <ul className="text-left space-y-1">
                <li>• You'll receive a confirmation email with meeting details</li>
                <li>• A reminder will be sent 10 minutes before the meeting</li>
                <li>• Please join the meeting on time</li>
                {isCustomMeeting && <li>• This is a custom meeting room - no external service required</li>}
                {isJitsiMeet && <li>• Jitsi Meet is free and doesn't require any account</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Video className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Google Meet Consultation</h1>
            <p className="text-gray-600">Schedule and join professional consultations via Google Meet</p>
          </div>

          {/* Main Content */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Schedule Consultation */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 opacity-10 rounded-full transform translate-x-16 -translate-y-16"></div>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Video className="w-5 h-5 text-blue-600" />
                  </div>
                  <CardTitle>Schedule Consultation</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Shield className="w-4 h-4" />
                    <span>Secure Google Meet</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>40-minute sessions</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>Professional consultation</span>
                  </div>
                </div>
                <Button 
                  onClick={handleStartBooking}
                  className="w-full"
                  size="lg"
                  disabled={!user}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Schedule Consultation
                </Button>
                {!user && (
                  <p className="text-xs text-amber-600 text-center">
                    Please log in to schedule a consultation
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Join Existing Meeting */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-blue-500 opacity-10 rounded-full transform translate-x-16 -translate-y-16"></div>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-green-600" />
                  </div>
                  <CardTitle>Join Scheduled Meeting</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="meetLink" className="text-sm font-medium text-gray-700">
                    Google Meet Link
                  </label>
                  <Input
                    id="meetLink"
                    type="url"
                    placeholder="Enter Google Meet link"
                    value={meetLink}
                    onChange={(e) => setMeetLink(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Enter the Google Meet link from your confirmation email
                  </p>
                </div>
                <Button 
                  onClick={handleJoinMeeting}
                  className="w-full"
                  size="lg"
                  disabled={!meetLink.trim()}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Join Google Meet
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Secure</h3>
              <p className="text-sm text-gray-600">Google Meet enterprise security</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Scheduled</h3>
              <p className="text-sm text-gray-600">Book appointments in advance</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Professional</h3>
              <p className="text-sm text-gray-600">Expert digital marketing consultation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MeetingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <MeetingPageContent />
    </Suspense>
  );
}
