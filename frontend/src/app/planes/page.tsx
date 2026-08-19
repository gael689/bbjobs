import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckIcon, StarIcon, UserGroupIcon, BriefcaseIcon, ShieldCheckIcon, LockClosedIcon,
} from "@heroicons/react/24/outline";

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

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

const PLANES = [
  {
    nombre: "Publicar",
    precio: "Gratis",
    detalle: "Siempre",
    icono: BriefcaseIcon,
    destacado: false,
    resumen: "Todo lo que necesitás para buscar personal en Bahía Blanca.",
    incluye: [
      "Publicá todas las búsquedas que quieras",
      "Recibí postulaciones sin límite",
      "Mirá el perfil y el CV de quienes se postulan",
      "Filtrá postulantes por edad, experiencia y puesto",
      "Estadísticas de tus búsquedas",
    ],
  },
  {
    nombre: "Destacar",
    precio: pesos(FEATURED_JOB_PRICE),
    detalle: "Por búsqueda",
    icono: StarIcon,
    destacado: false,
    resumen: "Para una búsqueda urgente o difícil de cubrir.",
    incluye: [
      "Tu aviso arriba de los resultados",
      "Resaltado entre los demás",
      "Dura lo que dure la búsqueda, sin renovar",
      "Prioridad de revisión de Talency",
    ],
  },
  {
    nombre: "Base de Talento",
    precio: pesos(TALENT_PACK_PRICE),
    detalle: `${TALENT_PACK_CREDITS} desbloqueos`,
    icono: UserGroupIcon,
    destacado: true,
    resumen: "No esperes a que se postulen: buscá vos.",
    incluye: [
      "Buscá en toda la base de candidatos",
      "Filtrá por puesto, experiencia, edad y zona",
      "Mirar perfiles no consume desbloqueos",
      `${TALENT_PACK_CREDITS} desbloqueos de contacto para usar cuando quieras`,
      "Lo que desbloqueás queda tuyo para siempre",
      "Sin vencimiento",
    ],
  },
];

export default function PlanesPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">
            Planes y precios
          </span>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-[#1C2230] leading-tight mb-4">
            Publicar es gratis.<br />Siempre lo fue.
          </h1>
          <p className="text-lg text-[#64748B] leading-relaxed">
            Toda empresa verificada puede publicar búsquedas y ver a quienes se postulan sin pagar
            nada. Lo de abajo es para cuando querés ir a buscar vos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
          {PLANES.map(plan => {
            const Icono = plan.icono;
            return (
              <div
                key={plan.nombre}
                className={`bg-white rounded-2xl p-7 flex flex-col ${
                  plan.destacado
                    ? "border-2 border-[#1E8EA3] shadow-lg lg:-mt-3 lg:mb-[-0.75rem]"
                    : "border border-[#DDE3EC]"
                }`}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    plan.destacado ? "bg-[#1E8EA3]" : "bg-[#E6F4F7]"
                  }`}>
                    <Icono className={`w-6 h-6 ${plan.destacado ? "text-white" : "text-[#1E8EA3]"}`} />
                  </div>
                  <h2 className="font-display font-extrabold text-xl text-[#1C2230]">{plan.nombre}</h2>
                </div>

                <div className="mb-2">
                  <span className="font-display font-extrabold text-3xl text-[#1C2230]">{plan.precio}</span>
                  <span className="text-sm text-[#64748B] ml-2">{plan.detalle}</span>
                </div>
                <p className="text-sm text-[#64748B] mb-6">{plan.resumen}</p>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.incluye.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[#1C2230]">
                      <CheckIcon className="w-4 h-4 text-[#1E8EA3] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`text-center text-sm font-bold px-5 py-3 rounded-xl transition-colors ${
                    plan.destacado
                      ? "text-white bg-[#1E8EA3] hover:bg-[#187B8E]"
                      : "text-[#1E8EA3] border border-[#9ED4DF] bg-[#E6F4F7] hover:bg-[#D5EBF1]"
                  }`}
                >
                  {plan.precio === "Gratis" ? "Crear cuenta de empresa" : "Empezar"}
                </Link>
              </div>
            );
          })}
        </div>

        {/* ── Qué es un perfil en gris ──
            Nadie paga por algo que no entiende: esta sección existe para que la empresa sepa
            exactamente qué compra antes de comprarlo. */}
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 md:p-10 mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-3">
                Cómo funciona la Base de Talento
              </span>
              <h2 className="font-display font-extrabold text-2xl text-[#1C2230] mb-4">
                Mirás todo. Pagás sólo por a quién querés contactar.
              </h2>
              <p className="text-[#64748B] leading-relaxed mb-4">
                Podés recorrer la base entera y filtrar cuanto quieras sin gastar nada. Cada perfil
                te muestra la experiencia, los estudios, las habilidades y la disponibilidad — todo
                menos quién es.
              </p>
              <p className="text-[#64748B] leading-relaxed">
                Cuando encontrás a alguien que te sirve, lo desbloqueás y accedés a su nombre,
                teléfono, mail y CV completo. Ese perfil queda tuyo para siempre: volver a abrirlo
                no cuesta otro desbloqueo.
              </p>
            </div>

            {/* Ejemplo de tarjeta en gris */}
            <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0">
                  <LockClosedIcon className="w-5 h-5 text-[#9ED4DF]" />
                </div>
                <div>
                  <p className="font-display font-bold text-[#1C2230]">Candidato #A3F91C</p>
                  <p className="text-xs text-[#64748B]">34 años · Bahía Blanca · Disp. inmediata</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-[#1C2230] mb-4">
                <p>6 años de experiencia</p>
                <p>Secundario completo · Técnico en Administración</p>
                <p className="text-[#64748B] text-xs">Último: Vendedor (2 años y 4 meses)</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {["Excel", "Atención al cliente", "Inglés"].map(s => (
                  <span key={s} className="text-[11px] font-medium bg-white text-[#64748B] border border-[#DDE3EC] px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
              <div className="border-t border-[#DDE3EC] pt-3 flex items-center gap-2 text-xs text-[#94A3B8]">
                <LockClosedIcon className="w-4 h-4 shrink-0" />
                Nombre, foto, contacto y CV ocultos
              </div>
            </div>
          </div>
        </div>

        {/* ── Consentimiento: es el diferencial y es verdad ── */}
        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-7 flex items-start gap-4 mb-12">
          <ShieldCheckIcon className="w-8 h-8 text-[#1E8EA3] shrink-0" />
          <div>
            <h3 className="font-display font-bold text-[#1C2230] text-lg mb-1.5">
              No es una base de datos comprada
            </h3>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Cada persona que aparece en la Base de Talento autorizó expresamente que las empresas
              verificadas la encuentren y la contacten, y puede darse de baja cuando quiera. Por eso
              el acceso está reservado a empresas verificadas por Talency: no alcanza con pagar.
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-[#64748B] mb-3">
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
