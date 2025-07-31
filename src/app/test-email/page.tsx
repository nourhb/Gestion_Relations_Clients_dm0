"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { testEmailConnection, sendTestEmail } from './actions';

export default function TestEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const { toast } = useToast();

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const result = await testEmailConnection();
      if (result.success) {
        toast({
          title: "Email Service Test",
          description: "Email service is working correctly!",
        });
      } else {
        toast({
          title: "Email Service Test Failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Email Service Test Failed",
        description: "An error occurred while testing the email service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email address to send the test email",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await sendTestEmail(testEmail);
      if (result.success) {
        toast({
          title: "Test Email Sent",
          description: "Test email has been sent successfully!",
        });
      } else {
        toast({
          title: "Test Email Failed",
          description: result.error || "Failed to send test email",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Test Email Failed",
        description: "An error occurred while sending the test email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Email Service Test</h1>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Email Connection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Test if the email service is properly configured and working.
              </p>
              <Button 
                onClick={handleTestConnection} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Testing..." : "Test Connection"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="testEmail">Email Address</Label>
                <Input
                  id="testEmail"
                  type="email"
                  placeholder="Enter email address to send test email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleSendTestEmail} 
                disabled={isLoading || !testEmail}
                className="w-full"
              >
                {isLoading ? "Sending..." : "Send Test Email"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>SMTP Host:</strong> {process.env.NEXT_PUBLIC_SMTP_HOST || 'smtp.gmail.com'}</p>
                <p><strong>SMTP Port:</strong> {process.env.NEXT_PUBLIC_SMTP_PORT || '587'}</p>
                <p><strong>SMTP User:</strong> {process.env.NEXT_PUBLIC_SMTP_USER ? 'Configured' : 'Not configured'}</p>
                <p><strong>SMTP Pass:</strong> {process.env.NEXT_PUBLIC_SMTP_PASS ? 'Configured' : 'Not configured'}</p>
              </div>
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Setup Instructions:</h4>
                <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                  <li>Add SMTP credentials to your .env.local file:</li>
                  <li className="ml-4 font-mono text-xs">SMTP_HOST=smtp.gmail.com</li>
                  <li className="ml-4 font-mono text-xs">SMTP_PORT=587</li>
                  <li className="ml-4 font-mono text-xs">SMTP_USER=your-email@gmail.com</li>
                  <li className="ml-4 font-mono text-xs">SMTP_PASS=your-app-password</li>
                  <li>For Gmail, use an App Password instead of your regular password</li>
                  <li>Restart your development server after adding the environment variables</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 