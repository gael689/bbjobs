import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400","500","600","700","800"] });
const dmSans  = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap", weight: ["400","500","700"] });

export const metadata: Metadata = {
  title: "BBJobs — El trabajo que buscás está en Bahía",
  description: "Portal de empleos local de Bahía Blanca. Empresas verificadas, postulación con un click y matching con IA.",
  keywords: "empleo Bahía Blanca, trabajo Bahía Blanca, búsqueda laboral, Talency",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${jakarta.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[#FAFBFD] text-[#1C2230] font-sans flex flex-col antialiased relative">
        {/* Glow de fondo superior para que el Navbar haga efecto vidrio 24/7 */}
        <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-gradient-to-r from-[#1E8EA3]/30 to-[#9ED4DF]/30 blur-[80px] pointer-events-none z-0 rounded-full" />
        
        <Header />
        <main className="flex-1 w-full relative z-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

