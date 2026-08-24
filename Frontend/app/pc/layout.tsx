'use client';

import type { PropsWithChildren } from 'react';
import { PcColorModeProvider } from './_components/color-mode';
import { PcI18nProvider } from './_components/PcI18nProvider';


export default function PcLayout({ children }: PropsWithChildren) {
  return (
    <PcI18nProvider>
      <PcColorModeProvider>
        {children}
      </PcColorModeProvider>
    </PcI18nProvider>
  );
}
