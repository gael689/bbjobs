"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { BuildingOffice2Icon, CloudArrowUpIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { CompanyProfile } from "../types";

export default function CompanyPerfilPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [savingPublicProfile, setSavingPublicProfile] = useState(false);

  useEffect(() => {
    api.get("/me/company/profile").then(r => {
      setProfile(r.data);
      setDescription(r.data.description || "");
      setWebsite(r.data.website || "");
    }).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function handleSavePublicProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingPublicProfile(true);
    try {
      const r = await api.patch("/me/company/profile", {
        description: description || undefined,
        website: website || undefined,
      });
      setProfile(r.data);
      toast("Perfil público actualizado");
    } catch {
      toast("Error al guardar el perfil público");
    } finally {
      setSavingPublicProfile(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post("/me/company/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProfile(r.data);
      toast("Logo actualizado correctamente");
    } catch {
      toast("Error al subir el logo");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleRequestVerification() {
    try {
      await api.post("/me/company/verification/request", { notes: "" });
      setProfile(p => (p ? { ...p, verification_status: "pending" } : p));
      toast("Solicitud enviada. El equipo de BBJobs revisará tu empresa.");
    } catch {
      toast("Error al enviar solicitud");
    }
  }

  const verificationStatus = profile?.verification_status;
  const isVerified = verificationStatus === "verified";
  const isPending = verificationStatus === "pending";
  const isRejected = verificationStatus === "rejected";
  const isSuspended = verificationStatus === "suspended";

  return (
    <div>
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#E6F4F7] to-[#FAFBFD] border-b border-[#9ED4DF] px-4 sm:px-6 py-10">
        <div className="flex items-center gap-4">
          <div
            className="relative w-16 h-16 rounded-2xl border-2 border-[#9ED4DF] bg-white flex items-center justify-center cursor-pointer group overflow-hidden shrink-0"
            onClick={() => logoRef.current?.click()}
            title="Cambiar logo"
          >
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <BuildingOffice2Icon className="w-8 h-8 text-[#9ED4DF]" />
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <CloudArrowUpIcon className="w-6 h-6 text-white" />
            </div>
            {logoUploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

          <div>
            <p className="text-[#1E8EA3] font-bold text-sm uppercase tracking-wider mb-1">Perfil de empresa</p>
            <h1 className="text-2xl font-display font-bold text-[#1C2230]">{profile?.legal_name || "Mi empresa"}</h1>
            <p className="text-[#64748B] text-sm mt-0.5">CUIT: {profile?.cuit}</p>
            <p className="text-[#64748B] text-xs mt-1">Logo: PNG o JPG, fondo transparente recomendado, mín. 400×400px, máx. 2MB</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-8 space-y-6 max-w-3xl">
        {!isVerified && (
          <div className={`rounded-2xl border px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isPending ? "bg-amber-50 border-amber-200" :
            isRejected ? "bg-red-50 border-red-200" :
            isSuspended ? "bg-red-50 border-red-200" :
            "bg-[#E6F4F7] border-[#9ED4DF]"
          }`}>
            <div className="flex items-center gap-3">
              {isPending ? (
                <ClockIcon className="w-6 h-6 text-amber-500 shrink-0" />
              ) : (isRejected || isSuspended) ? (
                <XCircleIcon className="w-6 h-6 text-red-500 shrink-0" />
              ) : (
                <CheckCircleIcon className="w-6 h-6 text-[#1E8EA3] shrink-0" />
              )}
              <div>
                <p className="font-bold text-[#1C2230]">
                  {isPending ? "Verificación en proceso" :
                   isRejected ? "Verificación rechazada" :
                   isSuspended ? "Empresa suspendida" :
                   "Tu empresa aún no está verificada"}
                </p>
                <p className="text-sm text-[#64748B]">
                  {isPending
                    ? "El equipo de BBJobs está revisando tu empresa. Te notificaremos cuando esté lista."
                    : isRejected
                    ? "Contactá al administrador para más información."
                    : isSuspended
                    ? "Tu empresa fue suspendida. Contactá al equipo de BBJobs para resolverlo."
                    : "Solicitá la verificación para poder publicar búsquedas."}
                </p>
              </div>
            </div>
            {!isPending && !isRejected && !isSuspended && (
              <button
                onClick={handleRequestVerification}
                className="shrink-0 bg-[#1E8EA3] text-white font-bold rounded-full px-5 py-2.5 text-sm hover:bg-[#187B8E] transition-colors"
              >
                Solicitar verificación
              </button>
            )}
          </div>
        )}

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-display font-bold text-[#1C2230]">Datos de la empresa</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[#64748B] font-semibold">Razón social</dt>
              <dd className="text-[#1C2230] mt-0.5">{profile?.legal_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-[#64748B] font-semibold">CUIT</dt>
              <dd className="text-[#1C2230] mt-0.5">{profile?.cuit || "—"}</dd>
            </div>
            <div>
              <dt className="text-[#64748B] font-semibold">Responsable</dt>
              <dd className="text-[#1C2230] mt-0.5">{profile?.responsible_full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-[#64748B] font-semibold">Contacto</dt>
              <dd className="text-[#1C2230] mt-0.5">{profile?.responsible_email} · {profile?.responsible_phone}</dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSavePublicProfile} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-display font-bold text-[#1C2230]">Perfil público</h3>
              <p className="text-sm text-[#64748B] mt-0.5">
                Lo que ven los candidatos cuando entran al perfil de tu empresa desde un aviso.
              </p>
            </div>
            {isVerified && profile && (
              <a
                href={`/empresas/${profile.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-bold text-[#1E8EA3] hover:underline whitespace-nowrap"
              >
                Ver perfil público
              </a>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Descripción — ¿qué hace tu empresa?</label>
            <textarea
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Contales a los candidatos a qué se dedica tu empresa, tu cultura de trabajo, etc."
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Sitio web (opcional)</label>
            <input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://tuempresa.com.ar"
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={savingPublicProfile}
            className="bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-colors"
          >
            {savingPublicProfile ? "Guardando..." : "Guardar perfil público"}
          </button>
        </form>
      </div>
    </div>
  );
}
