import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

export interface CalendarEvent {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmail?: string;
  timeZone?: string;
}

export interface CreateEventResponse {
  success: boolean;
  eventId?: string;
  meetLink?: string;
  error?: string;
}

class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor(config: GoogleCalendarConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    if (config.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.refreshToken,
      });
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate Google OAuth consent URL
   */
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<any> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      throw new Error(`Failed to get tokens: ${error}`);
    }
  }

  /**
   * Set user credentials
   */
  setCredentials(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * Create a calendar event with Google Meet link
   */
  async createEvent(eventData: CalendarEvent): Promise<CreateEventResponse> {
    try {
      const event = {
        summary: eventData.summary,
        description: eventData.description || '',
        start: {
          dateTime: eventData.startDateTime,
          timeZone: eventData.timeZone || 'UTC',
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: eventData.timeZone || 'UTC',
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            },
          },
        },
        attendees: eventData.attendeeEmail ? [{ email: eventData.attendeeEmail }] : [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        guestsCanSeeOtherGuests: false,
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
      });

      const meetLink = response.data.conferenceData?.entryPoints?.find(
        (entry: any) => entry.entryPointType === 'video'
      )?.uri;

      return {
        success: true,
        eventId: response.data.id,
        meetLink: meetLink || response.data.hangoutLink,
      };
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      return {
        success: false,
        error: error.message || 'Failed to create calendar event',
      };
    }
  }

  /**
   * Get available time slots for a specific date
   */
  async getAvailableTimeSlots(date: string, duration: number = 40): Promise<any[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(9, 0, 0, 0); // 9 AM
      
      const endOfDay = new Date(date);
      endOfDay.setHours(18, 0, 0, 0); // 6 PM

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const busySlots = response.data.items || [];
      const availableSlots = [];

      // Generate time slots (9 AM to 6 PM, 40-minute slots with 5-minute breaks)
      let currentTime = new Date(startOfDay);
      const endTime = new Date(endOfDay);

      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);
        
        // Check if this slot conflicts with any existing event
        const hasConflict = busySlots.some((event: any) => {
          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);
          
          return (currentTime < eventEnd && slotEnd > eventStart);
        });

        if (!hasConflict && slotEnd <= endTime) {
          availableSlots.push({
            startTime: currentTime.toISOString(),
            endTime: slotEnd.toISOString(),
          });
        }

        // Move to next slot (40 minutes + 5 minutes break)
        currentTime = new Date(currentTime.getTime() + (duration + 5) * 60000);
      }

      return availableSlots;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      return [];
    }
  }

  /**
   * Check if a date has available time slots
   */
  async hasAvailableSlots(date: string): Promise<boolean> {
    const slots = await this.getAvailableTimeSlots(date);
    return slots.length > 0;
  }

  /**
   * Get bookable days for a month
   */
  async getBookableDays(year: number, month: number): Promise<any[]> {
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      
      // Skip weekends and past dates (must be at least 24 hours in advance)
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6 || currentDate < tomorrow) {
        days.push({ day, hasTimeSlots: false });
        continue;
      }

      const hasSlots = await this.hasAvailableSlots(currentDate.toISOString().split('T')[0]);
      days.push({ day, hasTimeSlots: hasSlots });
    }

    return days;
  }
}

export default GoogleCalendarService;