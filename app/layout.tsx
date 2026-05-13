import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter, Sora } from "next/font/google";
import React from "react";
import "./globals.css";
import { SessionProvider } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { ThemeProvider, CustomizationProvider } from "@jazzmind/busibox-app";
import { FetchWrapper } from "@jazzmind/busibox-app";
import { VersionBar } from "@jazzmind/busibox-app";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Newsletter Digest",
  description: "AI-powered newsletter summaries for Microsoft 365 mailboxes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const portalUrl = process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env.NEXT_PUBLIC_AI_PORTAL_URL || '';
  const appId = process.env.APP_NAME || 'newsletter-digest';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const portalBasePath = process.env.NEXT_PUBLIC_PORTAL_BASE_PATH || '/portal';

  const checkIntervalMs = process.env.NEXT_PUBLIC_AUTH_CHECK_INTERVAL_MS
    ? parseInt(process.env.NEXT_PUBLIC_AUTH_CHECK_INTERVAL_MS, 10)
    : undefined;
  const refreshBufferMs = process.env.NEXT_PUBLIC_AUTH_REFRESH_BUFFER_MS
    ? parseInt(process.env.NEXT_PUBLIC_AUTH_REFRESH_BUFFER_MS, 10)
    : undefined;
  const tokenExpiresOverrideMs = process.env.NEXT_PUBLIC_TOKEN_EXPIRES_OVERRIDE_MS
    ? parseInt(process.env.NEXT_PUBLIC_TOKEN_EXPIRES_OVERRIDE_MS, 10)
    : undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${fraunces.variable} ${inter.variable} ${geistMono.variable} antialiased`}>
        <FetchWrapper skipAuthUrls={['/api/auth/session', '/api/logout', '/api/health']} />
        <ThemeProvider>
          <SessionProvider
            appId={appId}
            portalUrl={portalUrl}
            basePath={basePath}
            checkIntervalMs={checkIntervalMs}
            refreshBufferMs={refreshBufferMs}
            tokenExpiresOverrideMs={tokenExpiresOverrideMs}
          >
            <CustomizationProvider apiEndpoint={`${portalBasePath}/api/portal-customization`}>
              {children}
              <VersionBar />
            </CustomizationProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
