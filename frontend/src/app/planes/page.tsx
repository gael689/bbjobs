import Link from "next/link";
import type { Metadata } from "next";
import { CheckIcon, StarIcon, UserGroupIcon, BriefcaseIcon } from "@heroicons/react/24/outline";
import SaberMasTalento from "@/components/planes/SaberMasTalento";

export const metadata: Metadata = {
  title: "Planes y precios",
  description:
    "Publicar búsquedas en BBJobs es gratis para toda empresa verificada. Destacá un aviso o accedé a la Base de Talento de Bahía Blanca.",
};

// Espejo de backend/app/schemas/payment.py. Si cambia allá, cambia acá — el precio está en dos
// lugares y mostrar uno mientras se cobra el otro es la peor forma de enterarse.
const FEATURED_JOB_PRICE = 5000;
const TALENT_PACK_PRICE = 49900;
const TALENT_PACK_CREDITS = 15;

const pesos = (n: number) => n.toLocaleString("es-AR");

type Plan = {
  nombre: string;
  precio: string;
  moneda?: boolean;
  unidad: string;
  icono: typeof BriefcaseIcon;
  resumen: string;
  incluye: string[];
  destacado?: boolean;
  cta: string;
};

const PLANES: Plan[] = [
  {
    nombre: "Publicar",
    precio: "Gratis",
    unidad: "Siempre",
    icono: BriefcaseIcon,
    resumen: "Todo lo necesario para buscar personal en Bahía Blanca.",
    incluye: [
      "Búsquedas ilimitadas",
      "Postulaciones sin límite",
      "Perfil y CV de quienes se postulan",
      "Filtros por edad, experiencia y puesto",
      "Estadísticas de tus búsquedas",
    ],
    cta: "Crear cuenta de empresa",
  },
  {
    nombre: "Destacar",
    precio: pesos(FEATURED_JOB_PRICE),
    moneda: true,
    unidad: "Por búsqueda",
    icono: StarIcon,
    resumen: "Para una búsqueda urgente o difícil de cubrir.",
    incluye: [
      "Tu aviso arriba de los resultados",
      "Resaltado entre los demás",
      "Dura lo que dure la búsqueda",
      "Sin renovaciones ni vencimientos",
      "Prioridad de revisión de Talency",
    ],
    cta: "Empezar",
  },
  {
    nombre: "Base de Talento",
    precio: pesos(TALENT_PACK_PRICE),
    moneda: true,
    unidad: `${TALENT_PACK_CREDITS} desbloqueos`,
    icono: UserGroupIcon,
    destacado: true,
    resumen: "No esperes a que se postulen: buscá vos.",
    incluye: [
      "Buscá en toda la base de candidatos",
      "Filtrá por puesto, experiencia, edad y zona",
      "Mirar perfiles no consume desbloqueos",
      `${TALENT_PACK_CREDITS} contactos para usar cuando quieras`,
      "Lo que desbloqueás queda tuyo para siempre",
      "Sin vencimiento",
    ],
    cta: "Empezar",
  },
];

export default function PlanesPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        <header className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-[0.18em] mb-5">
            Planes y precios
          </span>
          <h1 className="font-display font-extrabold text-4xl md:text-[52px] text-[#1C2230] leading-[1.08] tracking-tight mb-5 text-balance">
            Publicar es gratis.<br />Siempre lo fue.
          </h1>
          <p className="text-lg text-[#64748B] leading-relaxed">
            Toda empresa verificada publica búsquedas y ve a quienes se postulan sin pagar nada.
            Lo de abajo es para cuando querés ir a buscar vos.
          </p>
        </header>

        {/* Tres columnas parejas. `items-stretch` + `flex-col` con la lista en `flex-1` deja los
            botones alineados abajo aunque las tarjetas tengan distinta cantidad de ítems. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch mb-8">
          {PLANES.map(plan => {
            const Icono = plan.icono;
            return (
              <div
                key={plan.nombre}
                className={`relative bg-white rounded-3xl flex flex-col transition-shadow ${
                  plan.destacado
                    ? "border-2 border-[#1E8EA3] shadow-[0_12px_40px_-12px_rgba(30,142,163,0.35)]"
                    : "border border-[#DDE3EC] hover:shadow-[0_8px_28px_-14px_rgba(28,34,48,0.18)]"
                }`}
              >
                {plan.destacado && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1E8EA3] text-white text-[11px] font-bold uppercase tracking-[0.12em] px-3.5 py-1.5 rounded-full whitespace-nowrap">
                    Lo nuevo
                  </span>
                )}

                <div className="p-7 pb-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${
                    plan.destacado ? "bg-[#1E8EA3]" : "bg-[#E6F4F7]"
                  }`}>
                    <Icono className={`w-6 h-6 ${plan.destacado ? "text-white" : "text-[#1E8EA3]"}`} />
                  </div>

                  <h2 className="font-display font-extrabold text-lg text-[#1C2230] mb-3">
                    {plan.nombre}
                  </h2>

                  <div className="flex items-baseline gap-1 mb-1">
                    {plan.moneda && (
                      <span className="font-display font-bold text-xl text-[#64748B]">$</span>
                    )}
                    <span className="font-display font-extrabold text-[34px] leading-none text-[#1C2230] tracking-tight">
                      {plan.precio}
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-[#64748B] mb-4">{plan.unidad}</p>

                  <p className="text-sm text-[#64748B] leading-relaxed pb-6 border-b border-[#DDE3EC]">
                    {plan.resumen}
                  </p>
                </div>

                <ul className="flex-1 px-7 py-6 space-y-3">
                  {plan.incluye.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[#1C2230] leading-snug">
                      <span className="w-[18px] h-[18px] rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 mt-px">
                        <CheckIcon className="w-3 h-3 text-[#1E8EA3] stroke-[3]" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="px-7 pb-7 space-y-1">
                  <Link
                    href="/register"
                    className={`block text-center text-sm font-bold px-5 py-3.5 rounded-xl transition-colors ${
                      plan.destacado
                        ? "text-white bg-[#1E8EA3] hover:bg-[#187B8E]"
                        : "text-[#1E8EA3] border border-[#9ED4DF] bg-[#E6F4F7] hover:bg-[#D5EBF1]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                  {/* El detalle del perfil en gris vive detrás de este botón: en la tarjeta
                      rompía la comparación entre las tres columnas. */}
                  {plan.destacado && <SaberMasTalento credits={TALENT_PACK_CREDITS} />}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-[#64748B] mb-10">
          Todos los planes requieren una empresa verificada por Talency. La verificación es gratis
          y la hacemos a mano, una por una.
        </p>

        <div className="text-center border-t border-[#DDE3EC] pt-10">
          <p className="text-sm text-[#64748B] mb-2">
            ¿Dudas sobre cuál te conviene? Escribinos y lo vemos juntos.
          </p>
          <Link
            href="/contacto"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] transition-colors"
          >
            Hablar con Talency
          </Link>
        </div>
      </div>
    </div>
  );
}
