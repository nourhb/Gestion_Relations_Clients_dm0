import nodemailer from 'nodemailer';

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create transporter
const createTransporter = () => {
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.error('SMTP credentials not configured');
    return null;
  }

  return nodemailer.createTransporter(emailConfig);
};

// Email templates
export const emailTemplates = {
  requestConfirmation: (data: {
    name: string;
    requestId: string;
    serviceType: string;
    meetingType: string;
    problemDescription: string;
    selectedSlots: Array<{ date: string; time: string }>;
    email: string;
    phone: string;
    createdAt: string;
  }) => ({
    subject: `تأكيد طلبك - ${data.requestId} | Request Confirmation`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>تأكيد الطلب</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #FF6A0C 0%, #FF8C42 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .info-section { margin-bottom: 25px; }
          .info-section h3 { color: #FF6A0C; margin-bottom: 10px; font-size: 18px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .info-item { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #FF6A0C; }
          .info-label { font-weight: bold; color: #333; margin-bottom: 5px; }
          .info-value { color: #666; }
          .request-id { background: #FF6A0C; color: white; padding: 15px; border-radius: 8px; text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; }
          .slots-section { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .slot-item { background: white; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 3px solid #28a745; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .english-section { direction: ltr; text-align: left; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; }
          .english-section h3 { color: #FF6A0C; }
          @media (max-width: 600px) {
            .info-grid { grid-template-columns: 1fr; }
            .content { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 تم استلام طلبك بنجاح</h1>
            <p>شكراً لك على اختيار DigitalMen0</p>
          </div>
          
          <div class="content">
            <div class="request-id">
              معرف الطلب: ${data.requestId}
            </div>
            
            <div class="info-section">
              <h3>📋 تفاصيل الطلب</h3>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">الاسم الكامل</div>
                  <div class="info-value">${data.name}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">البريد الإلكتروني</div>
                  <div class="info-value">${data.email}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">رقم الهاتف</div>
                  <div class="info-value">${data.phone}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">نوع الخدمة</div>
                  <div class="info-value">${data.serviceType === 'coaching' ? 'التدريب' : 'الاستشارة'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">نوع اللقاء</div>
                  <div class="info-value">${data.meetingType === 'online' ? 'عبر الإنترنت' : 'شخصياً'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">تاريخ الطلب</div>
                  <div class="info-value">${new Date(data.createdAt).toLocaleDateString('ar-SA')}</div>
                </div>
              </div>
            </div>
            
            <div class="info-section">
              <h3>📝 وصف المشكلة</h3>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; line-height: 1.6;">
                ${data.problemDescription}
              </div>
            </div>
            
            <div class="slots-section">
              <h3>📅 المواعيد المختارة</h3>
              ${data.selectedSlots.map(slot => `
                <div class="slot-item">
                  <strong>التاريخ:</strong> ${new Date(slot.date).toLocaleDateString('ar-SA')} | 
                  <strong>الوقت:</strong> ${slot.time}
                </div>
              `).join('')}
            </div>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ ملاحظة مهمة</h4>
              <p style="margin: 0; color: #856404;">
                سنقوم بمراجعة طلبك والتواصل معك قريباً لتأكيد المواعيد النهائية والتفاصيل الأخرى.
                يرجى الاحتفاظ بهذا المعرف للرجوع إليه مستقبلاً.
              </p>
            </div>
            
            <div class="english-section">
              <h3>📧 Request Confirmation</h3>
              <p><strong>Request ID:</strong> ${data.requestId}</p>
              <p><strong>Service Type:</strong> ${data.serviceType === 'coaching' ? 'Coaching' : 'Consultation'}</p>
              <p><strong>Meeting Type:</strong> ${data.meetingType === 'online' ? 'Online' : 'In-person'}</p>
              <p><strong>Selected Slots:</strong> ${data.selectedSlots.length} slot(s)</p>
              <p>We will review your request and contact you soon to confirm the final appointments and other details.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>مع أطيب التحيات،<br>فريق DigitalMen0</p>
            <p>📧 info@digitalmen0.com | 📱 +966 50 123 4567</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      تأكيد الطلب - ${data.requestId}
      
      مرحباً ${data.name}،
      
      شكراً لك على طلبك خدمة من DigitalMen0. لقد استلمنا طلبك بنجاح.
      
      معرف الطلب: ${data.requestId}
      نوع الخدمة: ${data.serviceType === 'coaching' ? 'التدريب' : 'الاستشارة'}
      نوع اللقاء: ${data.meetingType === 'online' ? 'عبر الإنترنت' : 'شخصياً'}
      
      المواعيد المختارة:
      ${data.selectedSlots.map(slot => `- ${new Date(slot.date).toLocaleDateString('ar-SA')} في ${slot.time}`).join('\n')}
      
      وصف المشكلة:
      ${data.problemDescription}
      
      سنقوم بمراجعة طلبك والتواصل معك قريباً لتأكيد المواعيد والتفاصيل الأخرى.
      
      مع أطيب التحيات،
      فريق DigitalMen0
      
      ---
      
      Request Confirmation - ${data.requestId}
      
      Hi ${data.name},
      
      Thank you for your service request from DigitalMen0. We have successfully received it.
      
      Request ID: ${data.requestId}
      Service Type: ${data.serviceType === 'coaching' ? 'Coaching' : 'Consultation'}
      Meeting Type: ${data.meetingType === 'online' ? 'Online' : 'In-person'}
      
      Selected Slots:
      ${data.selectedSlots.map(slot => `- ${new Date(slot.date).toLocaleDateString('en-US')} at ${slot.time}`).join('\n')}
      
      Problem Description:
      ${data.problemDescription}
      
      We will review your request and contact you soon to confirm appointments and other details.
      
      Best regards,
      The DigitalMen0 Team
    `
  }),

  consultationScheduled: (data: {
    name: string;
    meetLink?: string;
    roomId?: string; // For backward compatibility
    consultId: string;
    serviceRequestId: string;
    consultationTime: string;
  }) => ({
    subject: `تم جدولة استشارة Google Meet - ${data.consultId} | Google Meet Consultation Scheduled`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>جدولة الاستشارة</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .meeting-info { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .meeting-link { background: #28a745; color: white; padding: 15px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 10px 0; font-weight: bold; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .info-item { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; }
          .info-label { font-weight: bold; color: #333; margin-bottom: 5px; }
          .info-value { color: #666; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .english-section { direction: ltr; text-align: left; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; }
          .english-section h3 { color: #28a745; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎥 تم جدولة استشارة Google Meet</h1>
            <p>استشارة Google Meet جاهزة</p>
          </div>
          
          <div class="content">
            <div class="meeting-info">
              <h3>📅 تفاصيل الاستشارة</h3>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">معرف الاستشارة</div>
                  <div class="info-value">${data.consultId}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">معرف الطلب</div>
                  <div class="info-value">${data.serviceRequestId}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">وقت الاستشارة</div>
                  <div class="info-value">${new Date(data.consultationTime).toLocaleString('ar-SA')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">نوع الاجتماع</div>
                  <div class="info-value">Google Meet</div>
                </div>
              </div>
              
              <h4>🔗 رابط Google Meet</h4>
              ${data.meetLink ? `
                <a href="${data.meetLink}" class="meeting-link" target="_blank">
                  انضم إلى Google Meet الآن
                </a>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                  الرابط: ${data.meetLink}
                </p>
              ` : `
                <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px;">
                  رابط Google Meet سيتم إرساله قريباً
                </div>
              `}
            </div>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #856404;">📋 تعليمات مهمة</h4>
              <ul style="margin: 0; color: #856404; padding-left: 20px;">
                <li>تأكد من وجود اتصال إنترنت مستقر</li>
                <li>اختبر الكاميرا والميكروفون قبل بدء الاستشارة</li>
                <li>انضم إلى Google Meet قبل 5 دقائق من الموعد المحدد</li>
                <li>احتفظ بهذا الرابط للرجوع إليه</li>
                <li>تأكد من أن لديك حساب Google أو يمكنك الانضمام كضيف</li>
                <li>ستتلقى تذكيراً بالبريد الإلكتروني قبل 10 دقائق من الاجتماع</li>
              </ul>
            </div>
            
            <div class="english-section">
              <h3>🎥 Google Meet Consultation Scheduled</h3>
              <p><strong>Consultation ID:</strong> ${data.consultId}</p>
              <p><strong>Request ID:</strong> ${data.serviceRequestId}</p>
              <p><strong>Consultation Time:</strong> ${new Date(data.consultationTime).toLocaleString('en-US')}</p>
              <p><strong>Meeting Type:</strong> Google Meet</p>
              ${data.meetLink ? `<p><strong>Google Meet Link:</strong> <a href="${data.meetLink}">${data.meetLink}</a></p>` : '<p><strong>Google Meet Link:</strong> Will be sent shortly</p>'}
              <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin-top: 15px;">
                <p style="margin: 0; font-size: 14px;"><strong>Important Notes:</strong></p>
                <ul style="margin: 5px 0 0 0; font-size: 14px;">
                  <li>You'll receive a calendar invitation with the meeting details</li>
                  <li>A reminder email will be sent 10 minutes before the meeting</li>
                  <li>You can join with a Google account or as a guest</li>
                  <li>Please test your camera and microphone beforehand</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>مع أطيب التحيات،<br>فريق DigitalMen0</p>
            <p>📧 info@digitalmen0.com | 📱 +966 50 123 4567</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      تم جدولة استشارة Google Meet - ${data.consultId}
      
      مرحباً ${data.name}،
      
      تم جدولة استشارة Google Meet بنجاح.
      
      معرف الاستشارة: ${data.consultId}
      معرف الطلب: ${data.serviceRequestId}
      وقت الاستشارة: ${new Date(data.consultationTime).toLocaleString('ar-SA')}
      نوع الاجتماع: Google Meet
      
      ${data.meetLink ? `رابط Google Meet:\n${data.meetLink}` : 'رابط Google Meet سيتم إرساله قريباً'}
      
      تعليمات مهمة:
      - تأكد من وجود اتصال إنترنت مستقر
      - اختبر الكاميرا والميكروفون قبل بدء الاستشارة
      - انضم إلى Google Meet قبل 5 دقائق من الموعد المحدد
      - احتفظ بهذا الرابط للرجوع إليه
      - تأكد من أن لديك حساب Google أو يمكنك الانضمام كضيف
      - ستتلقى تذكيراً بالبريد الإلكتروني قبل 10 دقائق من الاجتماع
      
      مع أطيب التحيات،
      فريق DigitalMen0
      
      ---
      
      Google Meet Consultation Scheduled - ${data.consultId}
      
      Hi ${data.name},
      
      Your Google Meet consultation has been scheduled successfully.
      
      Consultation ID: ${data.consultId}
      Request ID: ${data.serviceRequestId}
      Consultation Time: ${new Date(data.consultationTime).toLocaleString('en-US')}
      Meeting Type: Google Meet
      
      ${data.meetLink ? `Google Meet Link:\n${data.meetLink}` : 'Google Meet Link will be sent shortly'}
      
      Important Instructions:
      - Ensure you have a stable internet connection
      - Test your camera and microphone before the consultation
      - Join Google Meet 5 minutes before the scheduled time
      - Keep this link for future reference
      - You can join with a Google account or as a guest
      - You'll receive a reminder email 10 minutes before the meeting
      
      Best regards,
      The DigitalMen0 Team
    `
  })
};

// Email service functions
export const emailService = {
  // Send request confirmation email
  async sendRequestConfirmation(data: {
    name: string;
    requestId: string;
    serviceType: string;
    meetingType: string;
    problemDescription: string;
    selectedSlots: Array<{ date: string; time: string }>;
    email: string;
    phone: string;
    createdAt: string;
  }) {
    const transporter = createTransporter();
    if (!transporter) {
      console.error('Email transporter not available');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = emailTemplates.requestConfirmation(data);
      
      const mailOptions = {
        from: `"DigitalMen0" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Request confirmation email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send request confirmation email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send consultation scheduled email
  async sendConsultationScheduled(data: {
    name: string;
    meetLink?: string;
    roomId?: string; // For backward compatibility
    consultId: string;
    serviceRequestId: string;
    consultationTime: string;
    email: string;
  }) {
    const transporter = createTransporter();
    if (!transporter) {
      console.error('Email transporter not available');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = emailTemplates.consultationScheduled(data);
      
      const mailOptions = {
        from: `"DigitalMen0" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Consultation scheduled email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send consultation scheduled email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Test email configuration
  async testConnection() {
    const transporter = createTransporter();
    if (!transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await transporter.verify();
      return { success: true, message: 'Email service is working correctly' };
    } catch (error) {
      console.error('Email service test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}; 