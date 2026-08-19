"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  LockClosedIcon, LockOpenIcon, MagnifyingGlassIcon, UserCircleIcon,
  BriefcaseIcon, AcademicCapIcon, MapPinIcon, ShieldCheckIcon, SparklesIcon,
} from "@heroicons/react/24/outline";

// ── Tipos, espejo de app/api/v1/talent.py ──────────────────────────────
type BlindExperience = { role_title: string; months: number; company_name: string | null; description: string | null };
type BlindEducation = { level: string; degree: string; status: string; institution: string | null };

type TalentProfile = {
  id: string;
  reference: string;
  unlocked: boolean;
  age: number | null;
  zone_name: string | null;
  availability: string | null;
  immediate_availability: boolean | null;
  has_own_transport: boolean | null;
  accepts_remote: boolean;
  accepts_hybrid: boolean;
  accepts_onsite: boolean;
  years_of_experience: number;
  has_cv: boolean;
  completion_percent: number;
  experience: BlindExperience[];
  education: BlindEducation[];
  skills: string[];
  languages: string[];
  other_skill: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  cv_file_url: string | null;
  summary: string | null;
};

type Credits = {
  credits_total: number;
  credits_used: number;
  credits_available: number;
  pack_price: number;
  pack_credits: number;
  currency: string;
};

const EDUCATION_LABEL: Record<string, string> = {
  secundario: "Secundario", terciario: "Terciario",
  universitario: "Universitario", posgrado: "Posgrado",
};
const EDU_STATUS_LABEL: Record<string, string> = {
  graduado: "Graduado", en_curso: "En curso", abandonado: "Incompleto",
};
const AVAILABILITY_LABEL: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", ambos: "Full o part-time",
};

type Zona = { id: string; name: string };

const EMPTY_FILTERS = {
  position: "", age_min: "", age_max: "",
  experience_min: "", experience_max: "", zone_id: "", only_unlocked: false,
};

function duracion(meses: number): string {
  if (meses < 1) return "menos de un mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const años = Math.floor(meses / 12);
  const resto = meses % 12;
  const base = `${años} ${años === 1 ? "año" : "años"}`;
  return resto ? `${base} y ${resto} ${resto === 1 ? "mes" : "meses"}` : base;
}

export default function BaseDeTalentoPage() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [profiles, setProfiles] = useState<TalentProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<TalentProfile | null>(null);
  const [confirmando, setConfirmando] = useState<TalentProfile | null>(null);
  const [desbloqueando, setDesbloqueando] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  function avisar(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function paramsDe(f: typeof EMPTY_FILTERS) {
    const params: Record<string, string | number | boolean> = {};
    if (f.position.trim()) params.position = f.position.trim();
    if (f.age_min) params.age_min = f.age_min;
    if (f.age_max) params.age_max = f.age_max;
    if (f.experience_min) params.experience_min = f.experience_min;
    if (f.experience_max) params.experience_max = f.experience_max;
    if (f.zone_id) params.zone_id = f.zone_id;
    if (f.only_unlocked) params.only_unlocked = true;
    return params;
  }

  function aplicar(r: { data: { results: TalentProfile[]; total: number; credits_available: number } }) {
    setProfiles(r.data.results);
    setTotal(r.data.total);
    setCredits(c => (c ? { ...c, credits_available: r.data.credits_available } : c));
  }

  // La que usan los botones. En el montaje NO se llama a ésta: `loading` ya arranca en true y
  // llamarla desde el efecto dispararía react-hooks/set-state-in-effect por el setLoading.
  function buscar(f: typeof EMPTY_FILTERS) {
    setLoading(true);
    api.get("/me/company/talent", { params: paramsDe(f) })
      .then(aplicar)
      .catch(() => avisar("No pudimos cargar la Base de Talento."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.get("/me/company/talent/credits").then(r => setCredits(r.data)).catch(() => {});
    api.get("/catalogs/zones").then(r => setZonas(r.data)).catch(() => {});
    api.get("/me/company/talent")
      .then(aplicar)
      .catch(() => avisar("No pudimos cargar la Base de Talento."))
      .finally(() => setLoading(false));
  }, []);

  async function comprarPack() {
    setComprando(true);
    try {
      const r = await api.post("/me/company/talent/packs");
      // Se va a Mercado Pago. El pack lo activa el webhook al acreditarse, nunca esta pantalla.
      window.location.href = r.data.init_point;
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      avisar(detail || "No pudimos iniciar la compra. Probá de nuevo.");
      setComprando(false);
    }
  }

  async function desbloquear(p: TalentProfile) {
    setDesbloqueando(true);
    try {
      const r = await api.post(`/me/company/talent/${p.id}/unlock`);
      const completo: TalentProfile = r.data;
      setProfiles(ps => ps.map(x => (x.id === completo.id ? completo : x)));
      setDetalle(completo);
      setConfirmando(null);
      const cr = await api.get("/me/company/talent/credits");
      setCredits(cr.data);
      avisar(`Desbloqueaste a ${completo.first_name} ${completo.last_name}.`);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      avisar(detail || "No pudimos desbloquear el perfil.");
    } finally {
      setDesbloqueando(false);
    }
  }

  const sinCreditos = !credits || credits.credits_available === 0;

  return (
    <div>
      <h1 className="font-display font-extrabold text-2xl text-[#1C2230] mb-1">Base de Talento</h1>
      <p className="text-[#64748B] text-sm mb-6">
        Buscá entre todos los candidatos que autorizaron aparecer acá, aunque no se hayan postulado
        a tus búsquedas. Ver perfiles es gratis — usás un contacto sólo cuando decidís desbloquear a alguien.
      </p>

      {/* ── Saldo y compra ── */}
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
            <SparklesIcon className="w-6 h-6 text-[#1E8EA3]" />
          </div>
          <div>
            {credits ? (
              <>
                <p className="font-display font-extrabold text-xl text-[#1C2230] leading-tight">
                  {credits.credits_available} {credits.credits_available === 1 ? "contacto" : "contactos"} disponibles
                </p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {credits.credits_total > 0
                    ? `Usaste ${credits.credits_used} de ${credits.credits_total}.`
                    : "Todavía no compraste ningún pack."}
                </p>
              </>
            ) : (
              <p className="text-sm text-[#64748B]">Cargando tu saldo…</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={comprarPack}
          disabled={comprando}
          className="text-sm font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 px-5 py-2.5 rounded-xl transition-colors"
        >
          {comprando
            ? "Abriendo Mercado Pago…"
            : credits
              ? `Comprar ${credits.pack_credits} contactos — $${credits.pack_price.toLocaleString("es-AR")}`
              : "Comprar pack"}
        </button>
      </div>

      {/* ── Filtros ── */}
      <form
        onSubmit={e => { e.preventDefault(); buscar(filters); }}
        className="bg-white border border-[#DDE3EC] rounded-2xl p-4 mb-5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <input
            type="text" placeholder="Puesto (ej: comercial)"
            value={filters.position}
            onChange={e => setFilters(f => ({ ...f, position: e.target.value }))}
            className="col-span-2 border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
          />
          <input
            type="number" min={0} placeholder="Edad mín."
            value={filters.age_min}
            onChange={e => setFilters(f => ({ ...f, age_min: e.target.value }))}
            className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
          />
          <input
            type="number" min={0} placeholder="Edad máx."
            value={filters.age_max}
            onChange={e => setFilters(f => ({ ...f, age_max: e.target.value }))}
            className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
          />
          <input
            type="number" min={0} step={0.5} placeholder="Exp. mín. (años)"
            value={filters.experience_min}
            onChange={e => setFilters(f => ({ ...f, experience_min: e.target.value }))}
            className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
          />
          <select
            value={filters.zone_id}
            onChange={e => setFilters(f => ({ ...f, zone_id: e.target.value }))}
            className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">Todas las zonas</option>
            {zonas.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button type="submit" className="text-xs font-bold bg-[#1E8EA3] text-white rounded-lg px-4 py-2 hover:bg-[#187B8E] transition-colors">
            <MagnifyingGlassIcon className="w-4 h-4 inline mr-1" />
            Buscar
          </button>
          <button
            type="button"
            onClick={() => { setFilters(EMPTY_FILTERS); buscar(EMPTY_FILTERS); }}
            className="text-xs font-bold text-[#64748B] hover:text-[#1C2230] px-3 py-2"
          >
            Limpiar
          </button>
          <label className="flex items-center gap-2 text-xs font-medium text-[#1C2230] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.only_unlocked}
              onChange={e => {
                const f = { ...filters, only_unlocked: e.target.checked };
                setFilters(f); buscar(f);
              }}
              className="accent-[#1E8EA3]"
            />
            Sólo los que ya desbloqueé
          </label>
          {!loading && (
            <span className="text-xs text-[#64748B] ml-auto">
              {total} {total === 1 ? "perfil" : "perfiles"}
            </span>
          )}
        </div>
      </form>

      {/* ── Resultados ── */}
      {loading ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-10 text-center text-sm text-[#64748B]">
          Buscando…
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-10 text-center">
          <UserCircleIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-3" />
          <p className="text-[#64748B] font-medium">No hay perfiles que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map(p => (
            <TarjetaPerfil
              key={p.id}
              perfil={p}
              onVer={() => setDetalle(p)}
              onDesbloquear={() => setConfirmando(p)}
              sinCreditos={sinCreditos}
            />
          ))}
        </div>
      )}

      {detalle && (
        <ModalPerfil
          perfil={detalle}
          onCerrar={() => setDetalle(null)}
          onDesbloquear={() => { setConfirmando(detalle); }}
          sinCreditos={sinCreditos}
        />
      )}

      {confirmando && credits && (
        <ModalConfirmar
          perfil={confirmando}
          restantes={credits.credits_available}
          procesando={desbloqueando}
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => desbloquear(confirmando)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1C2230] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── tarjeta ────────────────────────────

function TarjetaPerfil({
  perfil, onVer, onDesbloquear, sinCreditos,
}: {
  perfil: TalentProfile; onVer: () => void; onDesbloquear: () => void; sinCreditos: boolean;
}) {
  const titulo = perfil.unlocked
    ? `${perfil.first_name} ${perfil.last_name}`
    : `Candidato ${perfil.reference}`;

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        {/* Sin desbloquear la foto no se muestra: no alcanza con difuminarla por CSS, porque la
            URL viajaría igual y bastaría con abrir el inspector. El backend no la manda. */}
        <div className="w-12 h-12 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 overflow-hidden">
          {perfil.unlocked && perfil.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={perfil.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserCircleIcon className="w-7 h-7 text-[#9ED4DF]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-[#1C2230] truncate">{titulo}</p>
          <p className="text-xs text-[#64748B] mt-0.5">
            {[
              perfil.age ? `${perfil.age} años` : null,
              perfil.zone_name,
              perfil.immediate_availability ? "Disp. inmediata" : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        {/* Cuán cargado está el perfil. Le dice a la empresa cuánta información va a encontrar
            del otro lado ANTES de gastar el desbloqueo — y no identifica a nadie. */}
        <div className="shrink-0 text-right">
          <p className={`font-display font-extrabold text-sm leading-none ${
            perfil.completion_percent >= 80 ? "text-[#1E8EA3]"
              : perfil.completion_percent >= 50 ? "text-[#1C2230]" : "text-[#94A3B8]"
          }`}>
            {perfil.completion_percent}%
          </p>
          <p className="text-[9px] text-[#94A3B8] uppercase tracking-wide mt-0.5">completo</p>
        </div>
      </div>

      {perfil.unlocked && (
        <span className="self-start text-[10px] font-bold text-[#1E8EA3] bg-[#E6F4F7] border border-[#9ED4DF] px-2 py-0.5 rounded-full mb-2">
          Desbloqueado
        </span>
      )}

      <div className="space-y-1.5 text-xs text-[#1C2230] mb-3">
        <p className="flex items-center gap-1.5">
          <BriefcaseIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {perfil.years_of_experience > 0
            ? `${perfil.years_of_experience} años de experiencia`
            : "Sin experiencia cargada"}
        </p>
        {perfil.education[0] && (
          <p className="flex items-center gap-1.5">
            <AcademicCapIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
            <span className="truncate">
              {EDUCATION_LABEL[perfil.education[0].level] || perfil.education[0].level} ·{" "}
              {perfil.education[0].degree}
            </span>
          </p>
        )}
        {perfil.experience[0] && (
          <p className="flex items-center gap-1.5 text-[#64748B]">
            <MapPinIcon className="w-4 h-4 text-[#9ED4DF] shrink-0" />
            <span className="truncate">
              Último: {perfil.experience[0].role_title} ({duracion(perfil.experience[0].months)})
            </span>
          </p>
        )}
      </div>

      {perfil.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {perfil.skills.slice(0, 4).map(s => (
            <span key={s} className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-2 py-0.5 rounded-full">
              {s}
            </span>
          ))}
          {perfil.skills.length > 4 && (
            <span className="text-[10px] text-[#94A3B8] px-1 py-0.5">+{perfil.skills.length - 4}</span>
          )}
        </div>
      )}

      <div className="mt-auto flex gap-2">
        <button
          type="button" onClick={onVer}
          className="flex-1 text-xs font-bold text-[#1E8EA3] border border-[#9ED4DF] bg-[#E6F4F7] hover:bg-[#D5EBF1] px-3 py-2 rounded-lg transition-colors"
        >
          Ver perfil
        </button>
        {!perfil.unlocked && (
          <button
            type="button" onClick={onDesbloquear} disabled={sinCreditos}
            title={sinCreditos ? "No te quedan contactos" : undefined}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors"
          >
            <LockClosedIcon className="w-3.5 h-3.5" />
            Desbloquear
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── modales ────────────────────────────

function ModalPerfil({
  perfil, onCerrar, onDesbloquear, sinCreditos,
}: {
  perfil: TalentProfile; onCerrar: () => void; onDesbloquear: () => void; sinCreditos: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display font-extrabold text-xl text-[#1C2230]">
              {perfil.unlocked ? `${perfil.first_name} ${perfil.last_name}` : `Candidato ${perfil.reference}`}
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              {[
                perfil.age ? `${perfil.age} años` : null,
                perfil.zone_name,
                perfil.availability ? AVAILABILITY_LABEL[perfil.availability] : null,
                perfil.has_own_transport ? "Con movilidad propia" : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onCerrar} className="text-[#94A3B8] hover:text-[#1C2230] text-xl leading-none px-2">×</button>
        </div>

        {!perfil.unlocked && (
          <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 mb-5 flex items-start gap-3">
            <LockClosedIcon className="w-5 h-5 text-[#94A3B8] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1C2230] mb-0.5">Perfil sin desbloquear</p>
              <p className="text-xs text-[#64748B] mb-3">
                Están ocultos el nombre, la foto, el teléfono, el mail, el CV y dónde trabajó.
                Usa 1 de tus contactos, y queda desbloqueado para siempre.
              </p>
              <button
                type="button" onClick={onDesbloquear} disabled={sinCreditos}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
              >
                <LockOpenIcon className="w-4 h-4" />
                {sinCreditos ? "No te quedan contactos" : "Desbloquear contacto"}
              </button>
            </div>
          </div>
        )}

        {perfil.unlocked && (
          <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl p-4 mb-5">
            <p className="text-xs font-bold text-[#1E8EA3] uppercase tracking-wide mb-2">Contacto</p>
            <div className="text-sm text-[#1C2230] space-y-1">
              {perfil.phone && <p>📞 {perfil.phone}</p>}
              {perfil.email && <p>✉️ {perfil.email}</p>}
              {perfil.cv_file_url && <p className="text-xs text-[#64748B]">Tiene CV cargado.</p>}
            </div>
          </div>
        )}

        {perfil.unlocked && perfil.summary && (
          <Seccion titulo="Sobre el candidato">
            <p className="text-sm text-[#1C2230] whitespace-pre-line">{perfil.summary}</p>
          </Seccion>
        )}

        {perfil.experience.length > 0 && (
          <Seccion titulo="Experiencia">
            <div className="space-y-3">
              {perfil.experience.map((e, i) => (
                <div key={i}>
                  <p className="text-sm font-bold text-[#1C2230]">{e.role_title}</p>
                  <p className="text-xs text-[#64748B]">
                    {e.company_name ? `${e.company_name} · ` : ""}{duracion(e.months)}
                  </p>
                  {e.description && <p className="text-xs text-[#64748B] mt-1">{e.description}</p>}
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {perfil.education.length > 0 && (
          <Seccion titulo="Educación">
            <div className="space-y-2">
              {perfil.education.map((e, i) => (
                <div key={i}>
                  <p className="text-sm text-[#1C2230]">
                    {e.degree}{" "}
                    <span className="text-xs text-[#64748B]">
                      ({EDUCATION_LABEL[e.level] || e.level} · {EDU_STATUS_LABEL[e.status] || e.status})
                    </span>
                  </p>
                  {e.institution && <p className="text-xs text-[#64748B]">{e.institution}</p>}
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {perfil.skills.length > 0 && (
          <Seccion titulo="Habilidades">
            <div className="flex flex-wrap gap-1.5">
              {perfil.skills.map(s => (
                <span key={s} className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2.5 py-1 rounded-full">{s}</span>
              ))}
              {perfil.other_skill && (
                <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2.5 py-1 rounded-full">{perfil.other_skill}</span>
              )}
            </div>
          </Seccion>
        )}

        {perfil.languages.length > 0 && (
          <Seccion titulo="Idiomas">
            <div className="flex flex-wrap gap-1.5">
              {perfil.languages.map(l => (
                <span key={l} className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2.5 py-1 rounded-full">{l}</span>
              ))}
            </div>
          </Seccion>
        )}
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">{titulo}</p>
      {children}
    </div>
  );
}

function ModalConfirmar({
  perfil, restantes, procesando, onCancelar, onConfirmar,
}: {
  perfil: TalentProfile; restantes: number; procesando: boolean;
  onCancelar: () => void; onConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]" onClick={onCancelar}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] flex items-center justify-center mb-4">
          <LockOpenIcon className="w-6 h-6 text-[#1E8EA3]" />
        </div>
        <h3 className="font-display font-extrabold text-lg text-[#1C2230] mb-2">
          ¿Desbloquear a Candidato {perfil.reference}?
        </h3>
        <p className="text-sm text-[#64748B] mb-1">
          Vas a ver su nombre, teléfono, mail, foto y CV completo.
        </p>
        <p className="text-sm text-[#64748B] mb-4">
          Usa <strong className="text-[#1C2230]">1 contacto</strong> y te quedan{" "}
          <strong className="text-[#1C2230]">{Math.max(0, restantes - 1)}</strong>. Queda desbloqueado
          para siempre — volver a abrirlo no cuesta nada.
        </p>
        <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-3 mb-5 flex items-start gap-2">
          <ShieldCheckIcon className="w-4 h-4 text-[#1E8EA3] shrink-0 mt-0.5" />
          <p className="text-xs text-[#64748B]">
            Este candidato autorizó expresamente que las empresas verificadas lo contacten.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button" onClick={onCancelar} disabled={procesando}
            className="flex-1 text-sm font-bold text-[#64748B] border border-[#DDE3EC] hover:bg-[#FAFBFD] px-4 py-2.5 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button" onClick={onConfirmar} disabled={procesando}
            className="flex-1 text-sm font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 px-4 py-2.5 rounded-xl transition-colors"
          >
            {procesando ? "Desbloqueando…" : "Sí, desbloquear"}
          </button>
        </div>
      </div>
    </div>
  );
}
