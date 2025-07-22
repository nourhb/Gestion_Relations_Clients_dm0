
import * as React from 'react';

interface ConfirmationEmailProps {
  name: string;
  requestId: string;
}

const ConfirmationEmail: React.FC<Readonly<ConfirmationEmailProps>> = ({ name, requestId }) => (
  <div style={{ fontFamily: 'sans-serif', direction: 'rtl', textAlign: 'right' }}>
    <h1 style={{ color: '#FF6A0C' }}>مرحباً {name},</h1>
    <p>شكراً لطلبك خدمة من DigitalMen0. لقد استلمنا طلبك بنجاح.</p>
    <p>
      هذا هو معرف طلبك للرجوع إليه مستقبلاً:
      <strong style={{ display: 'inline-block', margin: '0 5px', letterSpacing: '1px', color: '#333' }}>
        {requestId}
      </strong>
    </p>
    <p>سنقوم بمراجعة طلبك وسنتواصل معك قريباً لتأكيد المواعيد والتفاصيل الأخرى.</p>
    <p>مع أطيب التحيات،</p>
    <p>فريق DigitalMen0</p>
    <hr style={{ borderColor: '#eee' }} />
    <div style={{ direction: 'ltr', textAlign: 'left', color: '#888', fontSize: '12px' }}>
        <h2 style={{ color: '#FF6A0C' }}>Hi {name},</h2>
        <p>Thank you for your service request from DigitalMen0. We have successfully received it.</p>
        <p>
            This is your request ID for future reference:
            <strong style={{ display: 'inline-block', margin: '0 5px', letterSpacing: '1px', color: '#333' }}>
                {requestId}
            </strong>
        </p>
        <p>We will review your request and contact you soon to confirm appointments and other details.</p>
        <p>Best regards,</p>
        <p>The DigitalMen0 Team</p>
    </div>
  </div>
);

export default ConfirmationEmail;
