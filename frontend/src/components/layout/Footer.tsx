import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#f0d4e8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Marca */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-5">
            <Image src="/logo.png" alt="BBJobs" width={32} height={32} className="object-contain" />
            <span className="text-xl font-display font-extrabold tracking-tight">
              <span className="text-[#e91e8c]">BB</span>
              <span className="text-[#1a1a2e]">JOBS</span>
            </span>
          </div>
          <p className="text-sm text-[#6b7280] max-w-xs leading-relaxed mb-5">
            El portal de empleos de Bahía Blanca y la región. Una iniciativa de{" "}
            <a href="https://talency.com.ar" target="_blank" rel="noopener noreferrer" className="text-[#e91e8c] font-semibold hover:underline">
              Talency
            </a>.
          </p>
          <Link
            href="/register?type=company"
            className="inline-flex items-center gap-2 bg-[#e91e8c] text-white text-sm font-bold rounded-full px-5 py-2.5 hover:bg-[#c4177a] transition-colors"
          >
            Publicar aviso <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7280] mb-4">Plataforma</h4>
          <ul className="space-y-3 text-sm">
            <li><Link href="/" className="text-[#1a1a2e] hover:text-[#e91e8c] transition-colors font-medium">Ver avisos</Link></li>
            <li><Link href="/register?type=candidate" className="text-[#1a1a2e] hover:text-[#e91e8c] transition-colors font-medium">Subir mi CV</Link></li>
            <li><Link href="/register?type=company" className="text-[#1a1a2e] hover:text-[#e91e8c] transition-colors font-medium">Publicar búsqueda</Link></li>
            <li><Link href="/planes" className="text-[#1a1a2e] hover:text-[#e91e8c] transition-colors font-medium">Planes y precios</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7280] mb-4">Legal</h4>
          <ul className="space-y-3 text-sm">
            <li><Link href="/terminos" className="text-[#1a1a2e] hover:text-[#e91e8c] transition-colors font-medium">Términos de uso</Link></li>
            <li><Link href="/privacidad" className="text-[#1a1a2e] hover:text-[#e91e8c] transition-colors font-medium">Privacidad</Link></li>
            <li><Link href="/nosotros" className="text-[#1a1a2e] hover:text-[#e91e8c] transition-colors font-medium">Quiénes somos</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#f0d4e8] py-5 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6b7280]">
        <p>© {new Date().getFullYear()} BBJobs · Una iniciativa de Talency · Bahía Blanca, Argentina</p>
        <p>Hecho con ♥ para el mercado laboral local</p>
      </div>
    </footer>
  );
}
