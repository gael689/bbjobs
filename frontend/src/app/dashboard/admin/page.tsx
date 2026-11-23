"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ArrowRightIcon, ClockIcon } from "@heroicons/react/24/outline";
import { ADMIN_GROUPS } from "@/lib/adminMenu";
import type { Metrics } from "./types";

/** Lo que el Inicio pregunta de los módulos nuevos. Cada pedido puede fallar solo (módulo
 *  apagado o sin datos): la tarjeta queda sin número, nunca rompe la pantalla. */
interface Vivo {
  metrics: Metrics | null;
  revisionesPorAtender: number | null;
  respuestasNuevas: number | null;
  mailsHoy: number | null;
  mailsSanos: boolean | null;
  iaGastoHoy: number | null;
  iaAlertas: number | null;
  empresasAContactar: number | null;
}

const VACIO: Vivo = {
  metrics: null, revisionesPorAtender: null, respuestasNuevas: null, mailsHoy: null, mailsSanos: null,
  iaGastoHoy: null, iaAlertas: null, empresasAContactar: null,
};

const usd = (n: number) => `USD ${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

/** El dato en vivo de cada tarjeta: `aviso` la marca en ámbar (hay algo para hacer). */
function datoDe(href: string, v: Vivo): { texto: string; aviso?: boolean } | null {
  const m = v.metrics;
  switch (href) {
    case "/dashboard/admin/empresas":
      return m ? { texto: m.pending_companies ? `${m.pending_companies} por verificar` : `${m.verified_companies} verificadas`, aviso: !!m.pending_companies } : null;
    case "/dashboard/admin/candidatos":
      return m ? { texto: `${m.total_candidates} perfiles` } : null;
    case "/dashboard/admin/busquedas":
      return m ? { texto: m.pending_jobs ? `${m.pending_jobs} por aprobar` : `${m.total_jobs} publicadas`, aviso: !!m.pending_jobs } : null;
    case "/dashboard/admin/mensajes":
      return m ? { texto: m.pending_contact_messages ? `${m.pending_contact_messages} sin resolver` : "Al día", aviso: !!m.pending_contact_messages } : null;
    case "/dashboard/admin/pagos":
      return m ? { texto: `$${m.total_revenue_featured.toLocaleString("es-AR")} en destacados` } : null;
    case "/dashboard/admin/revisiones-cv":
      return v.revisionesPorAtender == null ? null
        : { texto: v.revisionesPorAtender ? `${v.revisionesPorAtender} por atender` : "Al día", aviso: v.revisionesPorAtender > 0 };
    case "/dashboard/admin/mails":
      return v.respuestasNuevas == null ? null
        : { texto: v.respuestasNuevas ? `${v.respuestasNuevas} nuevas` : "Al día", aviso: v.respuestasNuevas > 0 };
    case "/dashboard/admin/mails/enviados":
      return v.mailsHoy == null ? null : { texto: `${v.mailsHoy} hoy` };
    case "/dashboard/admin/mails/salud":
      return v.mailsSanos == null ? null : { texto: v.mailsSanos ? "Todo en orden" : "Envíos frenados", aviso: !v.mailsSanos };
    case "/dashboard/admin/ia":
      return v.iaGastoHoy == null ? null : { texto: `Hoy: ${usd(v.iaGastoHoy)}` };
    case "/dashboard/admin/ia/actividad":
      return v.iaAlertas == null ? null : { texto: v.iaAlertas ? `${v.iaAlertas} alertas hoy` : "Sin alertas", aviso: v.iaAlertas > 0 };
    case "/dashboard/admin/empresas-potenciales":
      return v.empresasAContactar == null ? null : { texto: `${v.empresasAContactar} en la lista` };
    default:
      return null;
  }
}

export default function AdminInicioPage() {
  const [v, setV] = useState<Vivo>(VACIO);

  useEffect(() => {
    const poner = (parcial: Partial<Vivo>) => setV(prev => ({ ...prev, ...parcial }));
    api.get<Metrics>("/admin/dashboard").then(r => poner({ metrics: r.data })).catch(() => {});
    api.get<{ status: string }[]>("/admin/cv-reviews")
      .then(r => poner({ revisionesPorAtender: r.data.filter(o => o.status === "paid" || o.status === "in_progress").length }))
      .catch(() => {});
    api.get<{ replies_new: number; sent_today: number; unhealthy: boolean }>("/admin/mail/health")
      .then(r => poner({ respuestasNuevas: r.data.replies_new, mailsHoy: r.data.sent_today, mailsSanos: !r.data.unhealthy }))
      .catch(() => {});
    api.get<{ today: { spend_usd: number; alerts: number } }>("/admin/ai/activity/summary")
      .then(r => poner({ iaGastoHoy: r.data.today.spend_usd, iaAlertas: r.data.today.alerts }))
      .catch(() => {});
    api.get<{ total: number }>("/admin/prospects", { params: { page: 1, size: 1 } })
      .then(r => poner({ empresasAContactar: r.data.total }))
      .catch(() => {});
  }, []);

  const m = v.metrics;
  const pendientes = [
    m?.pending_jobs ? { n: m.pending_jobs, texto: `búsqueda${m.pending_jobs > 1 ? "s" : ""} por aprobar`, href: "/dashboard/admin/busquedas" } : null,
    m?.pending_companies ? { n: m.pending_companies, texto: `empresa${m.pending_companies > 1 ? "s" : ""} por verificar`, href: "/dashboard/admin/empresas" } : null,
    v.revisionesPorAtender ? { n: v.revisionesPorAtender, texto: `revisión${v.revisionesPorAtender > 1 ? "es" : ""} de CV por atender`, href: "/dashboard/admin/revisiones-cv" } : null,
    v.respuestasNuevas ? { n: v.respuestasNuevas, texto: `respuesta${v.respuestasNuevas > 1 ? "s" : ""} de mail sin leer`, href: "/dashboard/admin/mails" } : null,
    m?.pending_contact_messages ? { n: m.pending_contact_messages, texto: `mensaje${m.pending_contact_messages > 1 ? "s" : ""} sin resolver`, href: "/dashboard/admin/mensajes" } : null,
  ].filter((x): x is { n: number; texto: string; href: string } => x !== null);
  const total = pendientes.reduce((a, p) => a + p.n, 0);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Inicio</h1>
      <p className="text-[#64748B] text-sm mb-6">Todo BBJobs ordenado por área. Arriba, lo que necesita tu atención hoy.</p>

      {total > 0 && (
        <div
          className="rounded-2xl px-6 py-5 mb-8 text-white shadow-sm"
          style={{ background: "linear-gradient(120deg, #146678, #1E8EA3)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <ClockIcon className="w-6 h-6 shrink-0 opacity-90" />
            <p className="font-display font-bold text-[15.5px]">
              {total} {total === 1 ? "cosa espera" : "cosas esperan"} tu revisión
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendientes.map(p => (
              <Link key={p.href} href={p.href}
                className="group inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-[13px] font-bold transition-colors">
                {p.n} {p.texto}
                <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {ADMIN_GROUPS.map(g => (
          <section key={g.key} aria-labelledby={`grupo-${g.key}`}>
            <h2 id={`grupo-${g.key}`} className="font-display font-extrabold text-lg text-[#1C2230]">{g.title}</h2>
            <p className="text-sm text-[#64748B] mb-3">{g.desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {g.links.map(({ href, label, desc, icon: Icon }) => {
                const dato = datoDe(href, v);
                return (
                  <Link
                    key={href}
                    href={href}
                    className="group bg-white border border-[#DDE3EC] rounded-2xl p-4 flex flex-col gap-2 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </span>
                      <p className="font-display font-extrabold text-[15px] text-[#1C2230] leading-tight">{label}</p>
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">{desc}</p>
                    {dato && (
                      <span className={`self-start text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                        dato.aviso ? "bg-amber-100 text-amber-800" : "bg-[#E6F4F7] text-[#187B8E]"}`}>
                        {dato.texto}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
