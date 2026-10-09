import Link from "next/link";
import { BuildingOffice2Icon, ArrowRightIcon } from "@heroicons/react/24/outline";

// Bloque corto para empresas en las páginas de candidatos (/empleos-de/…, /trabajo-en/…):
// publicar gratis o que Talency se encargue de la búsqueda.
export default function BloqueEmpresas({ titulo, seleccionHref }: { titulo: string; seleccionHref: string }) {
  return (
    <aside className="bg-white border border-[#DDE3EC] rounded-2xl p-6 sm:p-8 mb-12" aria-label="Para empresas">
      <div className="flex items-start gap-3 mb-5">
        <BuildingOffice2Icon className="w-6 h-6 text-[#1E8EA3] shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-display font-bold text-lg text-[#1C2230]">{titulo}</p>
          <p className="text-sm text-[#1C2230] leading-relaxed">
            Publicá gratis en BBJobs y gestioná las postulaciones vos, o dejá que Talency se encargue de toda la búsqueda.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/publicar-empleo" className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold rounded-xl px-5 py-3 transition-colors">
          Publicar un empleo <ArrowRightIcon className="w-4 h-4" />
        </Link>
        <Link href={seleccionHref} className="inline-flex items-center justify-center gap-2 border border-[#9ED4DF] bg-[#E6F4F7] hover:bg-[#D5EBF1] text-[#187B8E] text-sm font-bold rounded-xl px-5 py-3 transition-colors">
          Que Talency se encargue
        </Link>
      </div>
    </aside>
  );
}
