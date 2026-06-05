import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-display" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BBJobs | Portal de Talento",
  description: "Encuentra tu próximo desafío profesional con BBJobs. Plataforma de reclutamiento ultra-moderna.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${dmSans.variable} dark`}>
      <body className="min-h-screen bg-[#0a0a0c] text-gray-200 font-sans flex flex-col relative antialiased selection:bg-[#00f0ff] selection:text-black">
        {/* Global Noise Texture Overlay */}
        <div className="bg-noise mix-blend-overlay fixed inset-0 w-full h-full" />
        
        <Header />
        <main className="flex-1 relative z-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
