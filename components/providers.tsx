'use client';
import React, { ReactNode } from 'react';
import { HeroUIProvider } from '@heroui/react';

function Providers({ children }: { children: ReactNode }) {
  return <HeroUIProvider>{children}</HeroUIProvider>;
}

export default Providers;
