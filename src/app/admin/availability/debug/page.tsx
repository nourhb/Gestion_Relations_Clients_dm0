"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { debugAvailability, getCombinedAvailability } from "../actions";
import { Loader2, Search, Calendar, Clock } from "lucide-react";

const SERVICE_PROVIDER_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1";

export default function AvailabilityDebugPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [testDate, setTestDate] = useState("2025-01-15");
  const [availabilityResult, setAvailabilityResult] = useState<any>(null);

  const handleDebug = async () => {
    setIsLoading(true);
    try {
      const result = await debugAvailability(SERVICE_PROVIDER_UID, testDate);
      setDebugResult(result);
      
      if (result.success) {
        toast({
          title: "Debug completed",
          description: `Found ${result.totalRequests} total requests, ${result.requestsForDate} for ${testDate}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Debug failed",
          description: result.error,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to run debug",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAvailability = async () => {
    setIsLoading(true);
    try {
      const result = await getCombinedAvailability(SERVICE_PROVIDER_UID, testDate);
      setAvailabilityResult(result);
      
      if (result.success) {
        toast({
          title: "Availability test completed",
          description: `Found ${result.finalSlots?.length || 0} available slots`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Availability test failed",
          description: result.error,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to test availability",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Availability System Debug
          </CardTitle>
          <CardDescription>
            Test and debug the availability system to identify issues with booked dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="test-date">Test Date</Label>
              <Input
                id="test-date"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleDebug} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Debug System
              </Button>
              <Button onClick={handleTestAvailability} disabled={isLoading} variant="outline">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Test Availability
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {debugResult && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600">Total Requests</div>
                  <div className="text-2xl font-bold">{debugResult.totalRequests}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600">Requests for Date</div>
                  <div className="text-2xl font-bold">{debugResult.requestsForDate}</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm text-orange-600">Booked Times</div>
                  <div className="text-2xl font-bold">{debugResult.bookedTimes?.length || 0}</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-purple-600">Daily Override</div>
                  <div className="text-2xl font-bold">
                    {debugResult.dailyOverride?.slots?.length || 0}
                  </div>
                </div>
              </div>

              {debugResult.bookedTimes && debugResult.bookedTimes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Booked Times:</h4>
                  <div className="flex flex-wrap gap-2">
                    {debugResult.bookedTimes.map((time: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {debugResult.requestsForDateDetails && debugResult.requestsForDateDetails.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Requests for {testDate}:</h4>
                  <div className="space-y-2">
                    {debugResult.requestsForDateDetails.map((req: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{req.userName || `${req.name} ${req.surname}`}</div>
                            <div className="text-sm text-gray-600">{req.email}</div>
                            <div className="text-sm text-gray-600">Status: {req.status}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">ID: {req.id.substring(0, 8)}</div>
                            <div className="text-sm text-gray-600">
                              {req.selectedSlots?.length || 0} slots
                            </div>
                          </div>
                        </div>
                        {req.selectedSlots && (
                          <div className="mt-2">
                            <div className="text-sm font-medium">Selected Slots:</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {req.selectedSlots.map((slot: any, slotIndex: number) => (
                                <span key={slotIndex} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {slot.date} {slot.time}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {availabilityResult && (
        <Card>
          <CardHeader>
            <CardTitle>Availability Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Success</div>
                <div className="text-lg font-medium">{availabilityResult.success ? "Yes" : "No"}</div>
              </div>
              
              {availabilityResult.error && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-600">Error</div>
                  <div className="text-sm">{availabilityResult.error}</div>
                </div>
              )}

              {availabilityResult.finalSlots && (
                <div>
                  <h4 className="font-medium mb-2">Available Slots ({availabilityResult.finalSlots.length}):</h4>
                  <div className="flex flex-wrap gap-2">
                    {availabilityResult.finalSlots.map((time: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 