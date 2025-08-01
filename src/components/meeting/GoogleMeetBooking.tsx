'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface GoogleMeetBookingProps {
  serviceRequestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  onBookingComplete: (meetLink: string) => void;
}

const GoogleMeetBooking: React.FC<GoogleMeetBookingProps> = ({
  serviceRequestId,
  userId,
  userName,
  userEmail,
  onBookingComplete
}) => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [availableDays, setAvailableDays] = useState<any[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Load available days for current month
  useEffect(() => {
    loadAvailableDays();
  }, [currentMonth]);

  // Load time slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      loadTimeSlots();
    }
  }, [selectedDate]);

  const loadAvailableDays = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      
      const response = await fetch(`/api/meeting?action=days&year=${year}&month=${month}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableDays(data.days);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to load available days",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load available days",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlots = async () => {
    if (!selectedDate) return;
    
    setLoading(true);
    try {
      const date = new Date(selectedDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      const response = await fetch(`/api/meeting?action=timeslots&year=${year}&month=${month}&day=${day}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableTimeSlots(data.timeSlots);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to load time slots",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load time slots",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTimeSlot) {
      toast({
        variant: "destructive",
        title: "Selection Required",
        description: "Please select a date and time slot",
      });
      return;
    }

    setBooking(true);
    try {
      const startDateTime = new Date(selectedTimeSlot.startTime);
      
      const response = await fetch('/api/meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'book',
          serviceRequestId,
          userId,
          userName,
          userEmail,
          year: startDateTime.getFullYear(),
          month: startDateTime.getMonth() + 1,
          day: startDateTime.getDate(),
          hour: startDateTime.getHours(),
          minute: startDateTime.getMinutes(),
          summary: `Consultation with ${userName}`,
          description: `Digital marketing consultation for service request ${serviceRequestId}`,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
                     title: "Booking Confirmed!",
           description: "Your Jitsi Meet consultation has been scheduled.",
        });
        onBookingComplete(data.meetLink);
      } else {
        toast({
          variant: "destructive",
          title: "Booking Failed",
          description: data.error || "Failed to book consultation",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Booking Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setBooking(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDayName = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    setSelectedDate('');
    setSelectedTimeSlot(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    setSelectedDate('');
    setSelectedTimeSlot(null);
  };

  const selectDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(date.toISOString().split('T')[0]);
    setSelectedTimeSlot(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-6 w-6 text-blue-600" />
                         <span>Schedule Jitsi Meet Consultation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>40-minute sessions</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span>One-on-one consultation</span>
            </div>
            <div className="flex items-center space-x-2">
              <ExternalLink className="h-4 w-4 text-gray-500" />
                             <span>Jitsi Meet link provided</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Select Date</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  ←
                </Button>
                <span className="font-medium">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  →
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading available dates...</p>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
                {availableDays.map((dayInfo, index) => {
                  const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayInfo.day);
                  const isSelected = selectedDate === dayDate.toISOString().split('T')[0];
                  const isAvailable = dayInfo.hasTimeSlots;
                  
                  return (
                    <Button
                      key={index}
                      variant={isSelected ? "default" : isAvailable ? "outline" : "ghost"}
                      size="sm"
                      className={`h-10 ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && selectDate(dayInfo.day)}
                    >
                      {dayInfo.day}
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Slots */}
        <Card>
          <CardHeader>
            <CardTitle>Select Time</CardTitle>
            {selectedDate && (
              <p className="text-sm text-gray-600">
                {formatDate(selectedDate)}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Please select a date first</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading time slots...</p>
              </div>
            ) : availableTimeSlots.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No available time slots for this date</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {availableTimeSlots.map((slot, index) => (
                  <Button
                    key={index}
                    variant={selectedTimeSlot === slot ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedTimeSlot(slot)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking Summary & Confirmation */}
      {selectedDate && selectedTimeSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <span>Booking Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Date & Time</h4>
                  <p className="text-sm text-gray-600">
                    {formatDate(selectedDate)} at {formatTime(selectedTimeSlot.startTime)}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Duration</h4>
                  <p className="text-sm text-gray-600">40 minutes</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Consultant</h4>
                  <p className="text-sm text-gray-600">DigitalMen0 دعم</p>
                </div>
                <div>
                                     <h4 className="font-medium text-gray-900">Meeting Type</h4>
                   <p className="text-sm text-gray-600">Jitsi Meet Video Call</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleBooking}
                  disabled={booking}
                  className="w-full"
                  size="lg"
                >
                  {booking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Booking...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Confirm Booking
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GoogleMeetBooking;