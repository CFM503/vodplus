import type { Metadata } from "next";
import "./globals.css";
import { ScrollToTop } from "@/components/ScrollToTop";

// Using system fonts to avoid Google Fonts connection issues in domestic environment
export const metadata: Metadata = {
  title: "vod",
  description: "vod - 极速影院",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body
        className="antialiased font-sans"
        suppressHydrationWarning
        style={{
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        }}
      >
        <div className="relative z-0">
          {children}
        </div>
        <ScrollToTop />
      </body>
    </html>
  );
}
