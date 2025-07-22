
"use client";

import Link from 'next/link';

export default function WhatsAppButton() {
  const phoneNumber = "+21651167244";
  const message = "مرحباً! أنا مهتم بخدماتكم.";
  const whatsappUrl = `https://wa.me/${phoneNumber.replace('+', '')}?text=${encodeURIComponent(message)}`;

  return (
    <Link
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      aria-label="تواصل معنا على واتساب"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-8 w-8"
      >
        <path d="M16.6 14.2c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.7-.8.9-.1.1-.3.2-.5.1-.2-.1-.9-.3-1.8-1.1-.7-.6-1.1-1.4-1.3-1.6s0-.4.1-.5l.4-.5c.1-.1.2-.2.3-.3s.1-.2 0-.4c-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3s-.7.7-.7 1.7.7 2 .8 2.1c.1.1 1.5 2.3 3.6 3.2.5.2.9.4 1.2.5.5.2 1 .1 1.3-.1s1.5-.6 1.7-1.2c.2-.5.2-1 .1-1.1l-.1-.1z" />
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18.2a8.2 8.2 0 1 1 8.2-8.2 8.2 8.2 0 0 1-8.2 8.2z" />
      </svg>
    </Link>
  );
}
