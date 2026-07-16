"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon, UsersIcon, CursorArrowRaysIcon, BoltIcon,
  ArrowRightIcon, CheckCircleIcon, BuildingOffice2Icon, LockClosedIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import ContactForm from "@/components/contact/ContactForm";

interface VerifiedCompany {
  id: string;
  legal_name: string;
  logo_url?: string | null;
  website?: string | null;
}

const REASONS = [
  {
    icon: ShieldCheckIcon,
    title: "Verificación manual",
    desc: "Cada empresa es revisada por el equipo de Talency antes de poder publicar. Nada de perfiles falsos ni cuentas fantasma.",
  },
  {
    icon: CursorArrowRaysIcon,
    title: "Postulaciones centralizadas",
    desc: "Recibís cada postulación en tu panel, con el perfil completo del candidato. Sin depender de mail, WhatsApp o redes sociales.",
  },
  {
    icon: BoltIcon,
    title: "Publicás en minutos",
    desc: "Cargás la búsqueda una vez — título, requisitos, salario si querés mostrarlo — y queda visible al instante para todo Bahía Blanca.",
  },
  {
    icon: UsersIcon,
    title: "Talento 100% local",
    desc: "Candidatos de Bahía Blanca y la región, con perfiles completos: CV, experiencia, formación y habilidades cargadas de antemano.",
  },
];

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<VerifiedCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    api.get("/companies/verified")
      .then(r => { if (!ignore) setCompanies(r.data); })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#E6F4F7] to-[#FAFBFD] border-b border-[#9ED4DF] px-4 sm:px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Para empresas</span>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-[#1C2230] leading-tight mb-5">
            El talento de Bahía Blanca<br />te está esperando
          </h1>
          <p className="text-lg text-[#64748B] max-w-2xl mx-auto mb-8">
            Publicá tu primera búsqueda gratis y accedé a candidatos locales verificados, sin intermediarios
            y sin perder postulaciones entre mails y grupos de WhatsApp.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register?type=company" className="inline-flex items-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-7 py-3.5 transition-colors shadow-sm">
              Publicar mi primera búsqueda <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <a href="#contacto-empresa" className="inline-flex items-center gap-2 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-7 py-3.5 hover:bg-white transition-colors">
              Hablar con nosotros
            </a>
          </div>
        </div>
      </section>

      {/* Por qué elegirnos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-3">¿Por qué elegirnos?</span>
          <h2 className="font-display font-extrabold text-3xl text-[#1C2230]">Reclutar en Bahía Blanca, sin fricción</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {REASONS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 hover:border-[#1E8EA3]/30 hover:shadow-sm transition-all">
              <div className="w-11 h-11 bg-[#E6F4F7] rounded-xl flex items-center justify-center mb-4 border border-[#9ED4DF]">
                <Icon className="w-5 h-5 text-[#1E8EA3]" />
              </div>
              <h3 className="font-display font-bold text-[#1C2230] mb-1.5">{title}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por qué confiar */}
      <section className="bg-white border-y border-[#DDE3EC] py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-3">Confianza</span>
            <h2 className="font-display font-extrabold text-3xl text-[#1C2230]">¿Por qué confiar en BBJOBS?</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <LockClosedIcon className="w-8 h-8 text-[#1E8EA3] mx-auto mb-3" />
              <p className="font-bold text-[#1C2230] mb-1">Datos protegidos</p>
              <p className="text-sm text-[#64748B]">Sólo ves el perfil de quienes se postulan a tus búsquedas. Nunca navegás una base de datos ajena.</p>
            </div>
            <div>
              <BuildingOffice2Icon className="w-8 h-8 text-[#1E8EA3] mx-auto mb-3" />
              <p className="font-bold text-[#1C2230] mb-1">Respaldo de Talency</p>
              <p className="text-sm text-[#64748B]">BBJOBS es un producto de Talency, consultora de RR.HH. bahiense — no una plataforma anónima.</p>
            </div>
            <div>
              <CheckCircleIcon className="w-8 h-8 text-[#1E8EA3] mx-auto mb-3" />
              <p className="font-bold text-[#1C2230] mb-1">Empresas reales</p>
              <p className="text-sm text-[#64748B]">Todas las empresas verificadas pasan por el mismo proceso de revisión manual. Sin excepciones.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Empresas que confían */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-3">Ya confían en nosotros</span>
          <h2 className="font-display font-extrabold text-3xl text-[#1C2230]">Empresas verificadas en BBJOBS</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white border border-dashed border-[#DDE3EC] rounded-2xl p-12 text-center max-w-lg mx-auto">
            <BuildingOffice2Icon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-4" />
            <p className="font-bold text-[#1C2230] mb-1">Sé una de las primeras</p>
            <p className="text-sm text-[#64748B]">Todavía estamos sumando las primeras empresas verificadas — la tuya puede ser una de ellas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {companies.map(c => (
              <Link
                key={c.id}
                href={`/empresas/${c.id}`}
                className="bg-white border border-[#DDE3EC] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 h-32 hover:border-[#1E8EA3]/40 hover:shadow-sm transition-all"
              >
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logo_url} alt={c.legal_name} className="max-h-12 max-w-full object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] flex items-center justify-center font-display font-extrabold text-[#1E8EA3]">
                    {c.legal_name[0]}
                  </div>
                )}
                <p className="text-xs font-semibold text-[#64748B] text-center line-clamp-1">{c.legal_name}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA + Contacto */}
      <section id="contacto-empresa" className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        <div className="text-center mb-8">
          <h2 className="font-display font-extrabold text-3xl text-[#1C2230] mb-3">¿Charlamos?</h2>
          <p className="text-[#64748B]">Contanos qué necesitás y te ayudamos a arrancar.</p>
        </div>
        <ContactForm topic="empresa" />
      </section>
    </div>
  );
}
