import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import "@solana/wallet-adapter-react-ui/styles.css";
import { SolanaProvider } from "@/components/provider/SolanaProvider";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivCam",
  description: "Decentralizing ANPR system",
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
        <SolanaProvider>

        <div className="bg-gradient-to-br from-[#1A1F2C] via-[#1A1F2C]/95 to-[#8B5CF6]/10">
        
        {children}
        </div>
        </SolanaProvider>
        <Toaster/>
      </body>
    </html>
  );
}
