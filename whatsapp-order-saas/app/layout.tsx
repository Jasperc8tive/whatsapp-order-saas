import type { Metadata } from "next";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useSyncOfflineOrders } from "@/lib/useSyncOfflineOrders";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "WhatsOrder — WhatsApp Order Management",
  description: "Manage WhatsApp orders for your business",
};

function RootLayoutComponent({ children }: { children: React.ReactNode }) {
  useSyncOfflineOrders();
  return (
    <>
      <OfflineIndicator />
      {children}
      <SpeedInsights />
    </>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{
          __html: `
            if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/service-worker.js');
              });
            }
          `
        }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <RootLayoutComponent>{children}</RootLayoutComponent>
      </body>
    </html>
  );
}
