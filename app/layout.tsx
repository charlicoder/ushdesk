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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://desk.ushspa.co'),
  title: 'USH Spa — Spa Center Dashboard',
  description:
    'Comprehensive multi-branch spa management platform for USH Spa. Monitor real-time appointments, branch availability, therapist schedules, and luxury wellness, massage, and spa services across all branches.',
  openGraph: {
    title: 'USH Spa — Spa Center Dashboard',
    description:
      'Comprehensive multi-branch spa management platform for USH Spa. Monitor real-time appointments, branch availability, therapist schedules, and luxury wellness, massage, and spa services across all branches.',
    url: 'https://desk.ushspa.co',
    siteName: 'USH Spa',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'USH Spa — Spa Center Dashboard',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'USH Spa — Spa Center Dashboard',
    description:
      'Comprehensive multi-branch spa management platform for USH Spa. Monitor real-time appointments, branch availability, therapist schedules, and luxury wellness, massage, and spa services across all branches.',
    images: ['/og-image.png'],
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
