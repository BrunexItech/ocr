import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import AppMain from "@/components/AppMain";
import PwaRegister from "@/components/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Oqtekal OCR",
  description: "Scan documents and extract accurate, structured data in seconds — review, approve, and send it anywhere.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Oqtekal" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#0a1430",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col lg:flex-row text-blue-100 app-shell-bg">
        <AuthProvider>
          <PwaRegister />
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AppMain>{children}</AppMain>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
