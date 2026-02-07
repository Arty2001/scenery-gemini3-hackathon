import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || "https://scenery-gemini3.fly.dev";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Scenery - AI Video Generation for React Components",
    template: "%s | Scenery",
  },
  description: "Transform your React component libraries into professional product videos with AI. Powered by Gemini 3.",
  keywords: ["React", "video generation", "AI", "Gemini", "component library", "product video", "Remotion"],
  authors: [{ name: "Athavan Thambimuthu" }],
  openGraph: {
    title: "Scenery - AI Video Generation for React Components",
    description: "Transform your React component libraries into professional product videos with AI. Powered by Gemini 3.",
    url: defaultUrl,
    siteName: "Scenery",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scenery - AI Video Generation for React Components",
    description: "Transform your React component libraries into professional product videos with AI. Powered by Gemini 3.",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
