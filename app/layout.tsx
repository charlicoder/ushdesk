import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'USH Spa — Spa Center Dashboard',
  description:
    'Comprehensive multi-branch spa management platform for USH Spa. Monitor real-time appointments, branch availability, therapist schedules, and luxury wellness, massage, and spa services across all branches.',
  openGraph: {
    title: 'USH Spa — Spa Center Dashboard',
    description:
      'Comprehensive multi-branch spa management platform for USH Spa. Monitor real-time appointments, branch availability, therapist schedules, and luxury wellness, massage, and spa services across all branches.',
    siteName: 'USH Spa',
    images: [
      {
        url: '/ush-spa-logo.png',
        alt: 'USH Spa Logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'USH Spa — Spa Center Dashboard',
    description:
      'Comprehensive multi-branch spa management platform for USH Spa. Monitor real-time appointments, branch availability, therapist schedules, and luxury wellness, massage, and spa services across all branches.',
    images: ['/ush-spa-logo.png'],
  },
  icons: {
    icon: '/ush-spa-logo.png',
    apple: '/ush-spa-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
