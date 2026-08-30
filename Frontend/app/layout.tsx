import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';
import { GlobalLogoutBridge } from './_components/GlobalLogoutBridge';
import './globals.css';
import 'orbcafe-ui/dist/index.css';

export const metadata: Metadata = {
  title: 'Travel Reimbursement',
  description: 'Travel Reimbursement App',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, minHeight: '100vh' }} suppressHydrationWarning>
        <GlobalLogoutBridge />
        {children}
      </body>
    </html>
  );
}
