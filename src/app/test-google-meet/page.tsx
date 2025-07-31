'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Calendar, ExternalLink } from 'lucide-react';

export default function TestGoogleMeetPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setLoading(true);
    try {
      const result = await testFn();
      setTestResults(prev => [...prev, {
        name: testName,
        success: true,
        result,
        timestamp: new Date().toISOString()
      }]);
    } catch (error: any) {
      setTestResults(prev => [...prev, {
        name: testName,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const testGoogleAuth = async () => {
    const response = await fetch('/api/google-auth?action=auth');
    const data = await response.json();
    if (data.success) {
      setAuthUrl(data.authUrl);
    }
    return data;
  };

  const testAvailableDays = async () => {
    const now = new Date();
    const response = await fetch(`/api/google-calendar?action=days&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
    return await response.json();
  };

  const testTimeSlots = async () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const response = await fetch(`/api/google-calendar?action=timeslots&year=${tomorrow.getFullYear()}&month=${tomorrow.getMonth() + 1}&day=${tomorrow.getDate()}`);
    return await response.json();
  };

  const clearResults = () => {
    setTestResults([]);
    setAuthUrl('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <span>Google Meet Integration Test</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Test the Google Meet integration functionality. Make sure you have configured the environment variables correctly.
            </p>
            
            <div className="flex flex-wrap gap-3 mb-6">
              <Button 
                onClick={() => runTest('Google Auth URL', testGoogleAuth)}
                disabled={loading}
              >
                Test Google Auth
              </Button>
              
              <Button 
                onClick={() => runTest('Available Days', testAvailableDays)}
                disabled={loading}
                variant="outline"
              >
                Test Available Days
              </Button>
              
              <Button 
                onClick={() => runTest('Time Slots', testTimeSlots)}
                disabled={loading}
                variant="outline"
              >
                Test Time Slots
              </Button>
              
              <Button 
                onClick={clearResults}
                variant="secondary"
              >
                Clear Results
              </Button>
            </div>

            {authUrl && (
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-blue-900 mb-2">Google OAuth URL Generated:</h4>
                <div className="flex items-center space-x-2">
                  <Input value={authUrl} readOnly className="text-sm" />
                  <Button 
                    size="sm" 
                    onClick={() => window.open(authUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Click the button to open the Google OAuth consent page in a new tab.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">{result.name}</span>
                      </div>
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      {new Date(result.timestamp).toLocaleString()}
                    </div>
                    
                    {result.success ? (
                      <pre className="bg-green-50 p-3 rounded text-sm overflow-x-auto">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    ) : (
                      <div className="bg-red-50 p-3 rounded text-sm text-red-700">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <h4>Required Environment Variables:</h4>
              <ul>
                <li><code>GOOGLE_CLIENT_ID</code> - Google OAuth Client ID</li>
                <li><code>GOOGLE_CLIENT_SECRET</code> - Google OAuth Client Secret</li>
                <li><code>GOOGLE_REDIRECT_URI</code> - OAuth Redirect URI</li>
                <li><code>GOOGLE_REFRESH_TOKEN</code> - Google Refresh Token (optional for testing)</li>
              </ul>
              
              <h4>Next Steps:</h4>
              <ol>
                <li>Configure your environment variables in <code>.env.local</code></li>
                <li>Test Google Auth to ensure OAuth is working</li>
                <li>If auth works, test the calendar endpoints</li>
                <li>Check the setup guide in <code>GOOGLE_MEET_SETUP.md</code> for detailed instructions</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}