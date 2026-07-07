import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#DDE3EC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-5">
            <Image src="/logo.png" alt="BBJobs" width={32} height={32} className="object-contain" />
            <span className="font-display font-extrabold italic text-xl tracking-tight">
              <span className="text-[#1E8EA3]">BB</span>
              <span className="text-[#1C2230]">JOBS</span>
            </span>
          </div>
          <p className="text-sm text-[#64748B] max-w-xs leading-relaxed mb-5">
            El portal de empleos de Bahía Blanca y la región. Una iniciativa de{" "}
            <a href="https://talency.com.ar" target="_blank" rel="noopener noreferrer" className="text-[#1E8EA3] font-semibold hover:underline">
              Talency
            </a>.
          </p>
          <Link href="/register?type=company" className="inline-flex items-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold rounded-lg px-5 py-2.5 transition-colors">
            Publicar aviso <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">Plataforma</h4>
          <ul className="space-y-3 text-sm">
            {[
              { href: "/", label: "Ver avisos" },
              { href: "/register?type=candidate", label: "Subir mi CV" },
              { href: "/register?type=company", label: "Publicar búsqueda" },
              { href: "/planes", label: "Planes y precios" },
            ].map(({ href, label }) => (
              <li key={href}><Link href={href} className="text-[#64748B] hover:text-[#1E8EA3] transition-colors font-medium">{label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">Legal</h4>
          <ul className="space-y-3 text-sm">
            {[
              { href: "/terminos", label: "Términos de uso" },
              { href: "/privacidad", label: "Política de privacidad" },
              { href: "/nosotros", label: "Quiénes somos" },
            ].map(({ href, label }) => (
              <li key={href}><Link href={href} className="text-[#64748B] hover:text-[#1E8EA3] transition-colors font-medium">{label}</Link></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#DDE3EC] py-5 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#94A3B8]">
        <p>© {new Date().getFullYear()} BBJobs · Una iniciativa de Talency · Bahía Blanca, Argentina</p>
        <p>Hecho con ♥ para el mercado laboral local</p>
      </div>
    </footer>
  );
}
