import Link from "next/link";
import { SparklesIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function PlanesPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20 flex items-center">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <div className="w-16 h-16 bg-[#E6F4F7] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <SparklesIcon className="w-8 h-8 text-[#1E8EA3]" />
        </div>
        <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Planes y precios</span>
        <h1 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mb-4">
          Próximamente
        </h1>
        <p className="text-lg text-[#64748B] leading-relaxed mb-8">
          Todavía estamos definiendo los planes de BBJobs. Hoy publicar búsquedas es gratis para toda empresa
          verificada — a futuro vamos a sumar la opción de destacar tus búsquedas para que lleguen a más candidatos.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
