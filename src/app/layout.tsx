import type { Metadata } from 'next';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import { validateStartupConfigOnce } from '@/server/runtime/startup-validation';
import './globals.css';

export const metadata: Metadata = {
  title: 'AG AliasRouter - Control Plane',
  description: 'AG AliasRouter route-based control plane UI',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico'
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await validateStartupConfigOnce();
  ensureRuntimeJobs();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
