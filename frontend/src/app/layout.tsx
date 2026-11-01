import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import NavBar from "@/components/NavBar";
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
  description: "Open-source, self-hosted OCR: scan, extract, review, approve, push to a database.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Oqtekal" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#121214",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <AuthProvider>
          <PwaRegister />
          <NavBar />
          <AppMain>{children}</AppMain>
        </AuthProvider>
      </body>
    </html>
  );
}
