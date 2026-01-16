import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "バスケ審判AI - JBA競技規則検索",
  description: "バスケットボール競技規則をAIで検索。審判の疑問を即座に解決します。",
  keywords: ["バスケットボール", "審判", "競技規則", "JBA", "AI"],
  authors: [{ name: "Basketball Referee AI" }],
  openGraph: {
    title: "バスケ審判AI",
    description: "バスケットボール競技規則をAIで検索。審判の疑問を即座に解決します。",
    url: "https://basketball-referee-ai.vercel.app",
    siteName: "バスケ審判AI",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "バスケ審判AI",
    description: "バスケットボール競技規則をAIで検索",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
