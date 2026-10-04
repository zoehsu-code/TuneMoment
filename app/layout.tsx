import type { Metadata } from 'next';
import { Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Providers } from './providers';
import { AppChrome } from '@/components/tunemoment/AppChrome';
import { clerkEnabled } from '@/lib/auth';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'TuneMoment — Turn moments into music.',
  description: 'Turn everyday videos into musical moments. Upload a moment and give it its own soundtrack.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'TuneMoment — Turn moments into music.',
    description: 'Turn everyday videos into musical moments.',
    siteName: 'TuneMoment',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'TuneMoment — Turn moments into music.',
    description: 'Turn everyday videos into musical moments.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const tree = (
    <Providers>
      <AppChrome>{children}</AppChrome>
    </Providers>
  );

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
      </head>
      <body className="min-h-screen bg-white text-[#17171B] antialiased">
        {clerkEnabled ? (
          <ClerkProvider afterSignOutUrl="/" appearance={{ variables: { colorPrimary: '#7C3AED' } }}>
            {tree}
          </ClerkProvider>
        ) : (
          tree
        )}
      </body>
    </html>
  );
}
