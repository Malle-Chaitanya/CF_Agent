import type { Metadata } from 'next';
import './globals.css';
import { Poppins } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CloudFuze Manage',
  description: 'SaaS Management Platform with AI Assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="bg-gray-100 text-gray-900 antialiased overflow-hidden" style={{ fontFamily: "var(--font-poppins), sans-serif" }}>{children}</body>
    </html>
  );
}
