"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BuildingOffice2Icon, CheckCircleIcon, XCircleIcon, ClockIcon, ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { VERIF_CLS, VERIF_LABEL, type Company } from "../types";

export default function AdminEmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  function fetchCompanies() {
    api.get("/admin/companies").then(r => setCompanies(r.data)).catch(() => toast("Error al cargar empresas", "error"));
  }

  function toast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function handleVerify(companyId: string, action: "approve" | "reject") {
    if (action === "reject") {
      setRejectModal(companyId);
      return;
    }
    setActionLoading(companyId + action);
    try {
      await api.patch(`/admin/companies/${companyId}/verify`, { action, notes: null });
      toast("Empresa verificada");
      fetchCompanies();
    } catch {
      toast("Error al verificar", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectModal) return;
    setActionLoading(rejectModal + "reject");
    try {
      await api.patch(`/admin/companies/${rejectModal}/verify`, { action: "reject", notes: rejectNotes || null });
      toast("Empresa rechazada");
      fetchCompanies();
    } catch {
      toast("Error al rechazar", "error");
    } finally {
      setActionLoading(null);
      setRejectModal(null);
      setRejectNotes("");
    }
  }

  async function handleSuspend(companyId: string) {
    setActionLoading(companyId + "suspend");
    try {
      await api.patch(`/admin/companies/${companyId}/suspend`);
      toast("Empresa suspendida");
      fetchCompanies();
    } catch {
      toast("Error al suspender", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate(companyId: string) {
    setActionLoading(companyId + "reactivate");
    try {
      await api.patch(`/admin/companies/${companyId}/reactivate`);
      toast("Empresa reactivada");
      fetchCompanies();
    } catch {
      toast("Error al reactivar", "error");
    } finally {
      setActionLoading(null);
    }
  }

  const pending = companies.filter(c => c.verification_status === "pending");

  return (
    <div className="px-4 sm:px-6 py-8">
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 border shadow-lg rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 ${
          toastMsg.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-[#9ED4DF] text-[#1C2230]"
        }`}>
          {toastMsg.type === "error"
            ? <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />
            : <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />}
          {toastMsg.text}
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-display font-bold text-[#1C2230] mb-3">Rechazar empresa</h2>
            <p className="text-sm text-[#64748B] mb-4">Indicá el motivo del rechazo (opcional, se enviará a la empresa).</p>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              rows={3}
              placeholder="Motivo del rechazo..."
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectNotes(""); }}
                className="flex-1 border border-[#DDE3EC] text-[#64748B] font-bold rounded-xl py-2.5 text-sm hover:bg-[#FAFBFD]">
                Cancelar
              </button>
              <button onClick={handleRejectConfirm} disabled={!!actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-60">
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Empresas</h1>
      <p className="text-[#64748B] text-sm mb-6">Gestioná la verificación de empresas registradas.</p>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-center gap-3 mb-6">
          <ClockIcon className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            Hay <span className="font-bold">{pending.length}</span> empresa{pending.length > 1 ? "s" : ""} esperando verificación.
          </p>
        </div>
      )}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#DDE3EC]/60">
        {companies.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Sin empresas registradas.</div>
        ) : (
          companies.map(company => (
            <div key={company.id} className="px-6 py-5 hover:bg-[#FAFBFD] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-[#DDE3EC] shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                      <BuildingOffice2Icon className="w-6 h-6 text-[#1E8EA3]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1C2230]">{company.legal_name}</p>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${VERIF_CLS[company.verification_status]}`}>
                        {VERIF_LABEL[company.verification_status]}
                      </span>
                    </div>
                    <p className="text-sm text-[#64748B] mt-0.5">CUIT: {company.cuit}</p>
                    <div className="text-sm text-[#64748B] mt-1 flex flex-col gap-0.5">
                      <span>{company.responsible_full_name} · {company.responsible_email}</span>
                      {company.verification_notes && (
                        <p className="text-xs text-red-600 mt-0.5">Nota: {company.verification_notes}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {company.verification_status === "pending" && (
                    <>
                      <button
                        onClick={() => handleVerify(company.id, "reject")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-sm font-bold border border-red-200 text-red-600 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleVerify(company.id, "approve")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                      >
                        {actionLoading === company.id + "approve" ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : <CheckCircleIcon className="w-4 h-4" />}
                        Verificar
                      </button>
                    </>
                  )}

                  {company.verification_status === "verified" && (
                    <button
                      onClick={() => handleSuspend(company.id)}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 text-sm font-bold border border-orange-200 text-orange-600 px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-60"
                    >
                      {actionLoading === company.id + "suspend" ? (
                        <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                      ) : <ShieldExclamationIcon className="w-4 h-4" />}
                      Suspender
                    </button>
                  )}

                  {company.verification_status === "suspended" && (
                    <button
                      onClick={() => handleReactivate(company.id)}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 text-sm font-bold bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      {actionLoading === company.id + "reactivate" ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : <CheckCircleIcon className="w-4 h-4" />}
                      Reactivar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
