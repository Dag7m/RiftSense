import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RiftSense",
  description: "Community-powered seismic sensor network",
};

import { SocketProvider } from "@/components/providers/socket-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <SocketProvider>
                <div className="flex min-h-screen flex-col">
                  <Navbar />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
                <Toaster position="top-right" richColors />
              </SocketProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
