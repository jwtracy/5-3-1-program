import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "5/3/1 Program Tracker",
  description: "Personal 5/3/1 workout program tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b">
          <nav className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight">
              5/3/1 Program Tracker
            </Link>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Link href="/calculator" className="hover:text-foreground">
                1RM
              </Link>
              <Link href="/settings" className="hover:text-foreground">
                Settings
              </Link>
              <Link href="/history" className="hover:text-foreground">
                History
              </Link>
              <Link href="/progress" className="hover:text-foreground">
                Progress
              </Link>
              <a
                href="https://exrx.net/WeightTraining/Powerlifting/531"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                About
              </a>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
