import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeftIcon, ArrowRightIcon, LockClosedIcon, LockOpenIcon,
  ShieldCheckIcon, MagnifyingGlassIcon, CheckIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "Cómo funciona la Base de Talento",
  description:
    "Buscá entre los candidatos de Bahía Blanca que autorizaron aparecer. Mirás todos los perfiles gratis y pagás sólo por los contactos que querés desbloquear.",
};

// Espejo de backend/app/schemas/payment.py.
const TALENT_PACK_PRICE = 49900;
const TALENT_PACK_CREDITS = 15;

const SE_VE = [
  "Edad y zona",
  "Disponibilidad y movilidad propia",
  "Presencial, remoto o híbrido",
  "Años de experiencia en total",
  "Los puestos que ocupó y cuánto duró cada uno",
  "Nivel educativo y título",
  "Habilidades e idiomas",
  "Qué tan completo está el perfil",
];

const SE_REVELA = [
  "Nombre y apellido",
  "Foto",
  "Teléfono y mail",
  "CV completo en PDF",
  "En qué empresas trabajó",
  "Qué hacía en cada puesto",
  "En qué institución estudió",
  "Su texto de presentación",
];

export default function BaseDeTalentoInfoPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[130px] pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <Link
          href="/planes"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748B] hover:text-[#1E8EA3] transition-colors mb-8"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Volver a planes
        </Link>

        <header className="max-w-2xl mb-14">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-[0.18em] mb-4">
            Base de Talento
          </span>
          <h1 className="font-display font-extrabold text-4xl md:text-[46px] text-[#1C2230] leading-[1.1] tracking-tight mb-5 text-balance">
            Mirás todo. Pagás sólo por a quién querés contactar.
          </h1>
          <p className="text-lg text-[#64748B] leading-relaxed">
            No esperes a que se postulen. Buscá vos entre los candidatos de Bahía Blanca que
            autorizaron que las empresas los encuentren.
          </p>
        </header>

        {/* ── Los tres pasos ──
            Numerados porque son una secuencia real: buscar, elegir, desbloquear. */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {[
            {
              n: "1",
              icono: MagnifyingGlassIcon,
              titulo: "Buscá gratis",
              texto: "Recorré la base entera y filtrá por puesto, experiencia, edad y zona. Mirar perfiles no consume nada.",
            },
            {
              n: "2",
              icono: LockClosedIcon,
              titulo: "Mirá el perfil en gris",
              texto: "Vas a ver su experiencia, estudios y habilidades — todo menos quién es.",
            },
            {
              n: "3",
              icono: LockOpenIcon,
              titulo: "Desbloqueá al que te sirva",
              texto: "Accedés a su nombre, teléfono, mail y CV. Queda tuyo para siempre.",
            },
          ].map(paso => {
            const Icono = paso.icono;
            return (
              <div key={paso.n} className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                    <Icono className="w-5 h-5 text-[#1E8EA3]" />
                  </div>
                  <span className="font-display font-extrabold text-2xl text-[#DDE3EC] leading-none">
                    {paso.n}
                  </span>
                </div>
                <h2 className="font-display font-bold text-[#1C2230] mb-2">{paso.titulo}</h2>
                <p className="text-sm text-[#64748B] leading-relaxed">{paso.texto}</p>
              </div>
            );
          })}
        </section>

        {/* ── El antes y después ── */}
        <section className="mb-16">
          <h2 className="font-display font-extrabold text-2xl text-[#1C2230] mb-2">
            El mismo candidato, antes y después
          </h2>
          <p className="text-[#64748B] mb-7 max-w-2xl">
            Un ejemplo con datos ficticios, para que veas exactamente qué cambia cuando gastás un
            desbloqueo.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 items-start">

            {/* Bloqueado */}
            <article className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-[#EEF2F7] text-[#64748B] px-3 py-1.5 rounded-full mb-5">
                <LockClosedIcon className="w-3.5 h-3.5" />
                Sin desbloquear
              </span>
              <div className="flex items-start gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-[#EEF2F7] flex items-center justify-center shrink-0">
                  <LockClosedIcon className="w-5 h-5 text-[#94A3B8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-[#64748B]">Candidato #A3F91C</p>
                  <p className="text-xs text-[#64748B] mt-0.5">34 años · Bahía Blanca · Disp. inmediata</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-extrabold text-sm text-[#1E8EA3] leading-none">85%</p>
                  <p className="text-[9px] text-[#94A3B8] uppercase tracking-wide mt-0.5">completo</p>
                </div>
              </div>
              <Dato label="Experiencia · 6 años">
                <p>Vendedor <Oculto>empresa oculta</Oculto> <span className="text-[#64748B]">— 2 años y 4 meses</span></p>
                <p className="mt-1">Repositor <Oculto>empresa oculta</Oculto> <span className="text-[#64748B]">— 3 años y 1 mes</span></p>
              </Dato>
              <Dato label="Estudios">
                <p>Técnico en Administración <span className="text-[#64748B]">· Secundario, graduado</span></p>
              </Dato>
              <Dato label="Habilidades e idiomas">
                <Chips items={["Excel", "Atención al cliente", "Trabajo en equipo", "Inglés"]} />
              </Dato>
              <div className="mt-5 pt-4 border-t border-[#DDE3EC] flex items-start gap-2 text-xs text-[#94A3B8]">
                <LockClosedIcon className="w-4 h-4 shrink-0 mt-px" />
                Ocultos: nombre, foto, teléfono, mail, CV, dónde trabajó y dónde estudió.
              </div>
            </article>

            <div className="hidden lg:flex w-11 h-11 rounded-full bg-[#1E8EA3] items-center justify-center self-center shrink-0">
              <ArrowRightIcon className="w-5 h-5 text-white" />
            </div>

            {/* Desbloqueado */}
            <article className="bg-white border-2 border-[#9ED4DF] rounded-2xl p-6">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-[#E6F4F7] text-[#1E8EA3] border border-[#9ED4DF] px-3 py-1.5 rounded-full mb-5">
                <LockOpenIcon className="w-3.5 h-3.5" />
                Desbloqueado · 1 crédito
              </span>
              <div className="flex items-start gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 font-display font-extrabold text-[#1E8EA3]">
                  MF
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-[#1C2230]">Marcos Ferreyra</p>
                  <p className="text-xs text-[#64748B] mt-0.5">34 años · Bahía Blanca · Disp. inmediata</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-extrabold text-sm text-[#1E8EA3] leading-none">85%</p>
                  <p className="text-[9px] text-[#94A3B8] uppercase tracking-wide mt-0.5">completo</p>
                </div>
              </div>
              <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl p-4 mb-4">
                <p className="text-[10px] font-bold text-[#1E8EA3] uppercase tracking-wider mb-2">Contacto</p>
                <p className="text-sm text-[#1C2230]">291 415-8823</p>
                <p className="text-sm text-[#1C2230]">m.ferreyra@gmail.com</p>
                <p className="text-sm text-[#1E8EA3] font-medium mt-1">CV completo en PDF</p>
              </div>
              <Dato label="Experiencia · 6 años">
                <p>Vendedor <span className="text-[#1E8EA3]">en Autoservicio San Martín</span> <span className="text-[#64748B]">— feb 2024 a jun 2026</span></p>
                <p className="mt-1">Repositor <span className="text-[#1E8EA3]">en Distribuidora Rondeau</span> <span className="text-[#64748B]">— ene 2021 a feb 2024</span></p>
              </Dato>
              <Dato label="Estudios">
                <p>Técnico en Administración <span className="text-[#1E8EA3]">· E.E.S.T. N.º 1</span></p>
              </Dato>
              <Dato label="Habilidades e idiomas">
                <Chips items={["Excel", "Atención al cliente", "Trabajo en equipo", "Inglés"]} />
              </Dato>
            </article>
          </div>
        </section>

        {/* ── Campo por campo ── */}
        <section className="mb-16">
          <h2 className="font-display font-extrabold text-2xl text-[#1C2230] mb-7">Campo por campo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-6">
              <p className="text-xs font-bold text-[#1E8EA3] uppercase tracking-wider mb-4">
                Se ve sin pagar
              </p>
              <ul className="space-y-2.5">
                {SE_VE.map(t => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-[#1C2230] leading-snug">
                    <CheckIcon className="w-4 h-4 text-[#1E8EA3] shrink-0 mt-0.5 stroke-[2.5]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">
                Se revela al desbloquear
              </p>
              <ul className="space-y-2.5">
                {SE_REVELA.map(t => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-[#64748B] leading-snug">
                    <LockClosedIcon className="w-4 h-4 text-[#D4B7A2] shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Por qué ── */}
        <section className="mb-16">
          <h2 className="font-display font-extrabold text-2xl text-[#1C2230] mb-7">
            Por qué se oculta justo eso
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Razon titulo="Dónde trabajó">
              «Vendedor en Autoservicio San Martín, 2024–2026» alcanza para saber de quién se trata:
              en Bahía, cualquiera del rubro lo averigua en dos llamadas. El <strong className="text-[#1C2230]">puesto
              y cuánto lo ejerció sí se ven</strong>, que es lo que sirve para decidir.
            </Razon>
            <Razon titulo="Su texto de presentación">
              Lo escribe el candidato con sus palabras, y muy seguido arranca con «Soy Marcos, tengo
              34 años…». Se filtraría el nombre sin que nadie lo decidiera.
            </Razon>
            <Razon titulo="El «85% completo» sí se ve">
              Te dice cuánta información vas a encontrar del otro lado <strong className="text-[#1C2230]">antes</strong> de
              gastar el desbloqueo. Así nadie paga por un perfil casi vacío.
            </Razon>
          </div>
        </section>

        {/* ── Consentimiento ── */}
        <section className="bg-white border border-[#9ED4DF] rounded-2xl p-7 md:p-8 flex flex-col sm:flex-row items-start gap-5 mb-14">
          <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-6 h-6 text-[#1E8EA3]" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-[#1C2230] mb-2">
              No es una base de datos comprada
            </h2>
            <p className="text-[#64748B] leading-relaxed">
              Cada persona que aparece en la Base de Talento autorizó expresamente que las empresas
              verificadas la encuentren y la contacten, y puede darse de baja cuando quiera. Además
              ve qué empresas accedieron a su perfil. Por eso el acceso está reservado a empresas
              verificadas por Talency: no alcanza con pagar.
            </p>
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className="bg-[#1C2230] rounded-3xl p-8 md:p-10 text-center">
          <p className="text-[#9ED4DF] text-xs font-bold uppercase tracking-[0.16em] mb-4">
            Pack de acceso
          </p>
          <p className="font-display font-extrabold text-white text-4xl md:text-5xl tracking-tight mb-2">
            ${TALENT_PACK_PRICE.toLocaleString("es-AR")}
          </p>
          <p className="text-[#9ED4DF] mb-1">{TALENT_PACK_CREDITS} desbloqueos · sin vencimiento</p>
          <p className="text-white/60 text-sm mb-7 max-w-md mx-auto">
            Los usás cuando quieras. Lo que desbloqueás queda tuyo para siempre.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/register"
              className="text-sm font-bold text-[#1C2230] bg-white hover:bg-[#E6F4F7] px-7 py-3.5 rounded-xl transition-colors"
            >
              Crear cuenta de empresa
            </Link>
            <Link
              href="/contacto"
              className="text-sm font-bold text-white border border-white/25 hover:bg-white/10 px-7 py-3.5 rounded-xl transition-colors"
            >
              Hablar con Talency
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">{label}</p>
      <div className="text-sm text-[#1C2230]">{children}</div>
    </div>
  );
}

function Oculto({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs text-[#94A3B8] bg-[#EEF2F7] rounded px-2 py-0.5">{children}</span>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(s => (
        <span key={s} className="text-[11px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-2.5 py-1 rounded-full">
          {s}
        </span>
      ))}
    </div>
  );
}

function Razon({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
      <h3 className="font-display font-bold text-[#1C2230] mb-2">{titulo}</h3>
      <p className="text-sm text-[#64748B] leading-relaxed">{children}</p>
    </div>
  );
}
