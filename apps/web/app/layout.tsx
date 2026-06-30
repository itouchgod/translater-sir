import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://www.translatersir.com"),
  applicationName: "Translater Sir",
  title: {
    default: "Translater Sir",
    template: "%s | Translater Sir",
  },
  description: "实时语音识别、同声传译、会议字幕和 AI 纪要工作台。",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Translater Sir",
    description: "实时语音识别、同声传译、会议字幕和 AI 纪要工作台。",
    url: "https://www.translatersir.com",
    siteName: "Translater Sir",
    images: [
      {
        url: "/brand/logo-source.png",
        width: 1000,
        height: 1000,
        alt: "Translater Sir logo",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Translater Sir",
    description: "实时语音识别、同声传译、会议字幕和 AI 纪要工作台。",
    images: ["/brand/logo-source.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
