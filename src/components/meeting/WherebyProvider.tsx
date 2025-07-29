"use client";

import React from 'react';
import { RoomProvider } from "@whereby.com/browser-sdk/react";

interface WherebyProviderProps {
  children: React.ReactNode;
}

const WherebyProvider: React.FC<WherebyProviderProps> = ({ children }) => {
  return (
    <RoomProvider>
      {children}
    </RoomProvider>
  );
};

export default WherebyProvider; 