"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChatBubbleLeftRightIcon, CheckCircleIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";
import type { ContactMessage } from "../types";

export default function AdminMensajesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [resolvedFilterLoaded, setResolvedFilterLoaded] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const loading = resolvedFilterLoaded !== showResolved;

  const fetchMessages = useCallback(() => {
    api.get("/admin/contact-messages", { params: showResolved ? {} : { resolved: false } })
      .then(r => setMessages(r.data))
      .catch(() => {})
      .finally(() => setResolvedFilterLoaded(showResolved));
  }, [showResolved]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  async function handleResolve(id: string) {
    setActionLoading(id);
    try {
      await api.patch(`/admin/contact-messages/${id}/resolve`);
      setMessages(prev => showResolved ? prev.map(m => m.id === id ? { ...m, resolved: true } : m) : prev.filter(m => m.id !== id));
    } catch {
      // no-op, el usuario puede reintentar
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-display font-bold text-[#1C2230]">Mensajes de contacto</h1>
      </div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[#64748B] text-sm">Consultas enviadas desde /contacto y /empresas.</p>
        <label className="flex items-center gap-2 text-sm text-[#64748B] cursor-pointer">
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} className="w-4 h-4 accent-[#1E8EA3]" />
          Mostrar resueltos
        </label>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-12 text-center">
          <ChatBubbleLeftRightIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-3" />
          <p className="text-[#64748B]">No hay mensajes {showResolved ? "" : "pendientes"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div
              key={m.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                m.resolved ? "border-[#DDE3EC]" : "border-amber-200 shadow-[inset_3px_0_0_#F59E0B]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-extrabold text-sm shrink-0 ${
                  m.topic === "empresa" ? "bg-[#E6F4F7] text-[#187B8E]" : "bg-[#F7EFE9] text-[#B98F72]"
                }`}>
                  {m.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-[#1C2230]">{m.name}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.topic === "empresa" ? "bg-[#E6F4F7] text-[#1E8EA3]" : "bg-gray-100 text-gray-600"}`}>
                          {m.topic === "empresa" ? "Empresa" : "General"}
                        </span>
                        {m.resolved && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Resuelto</span>
                        )}
                      </div>
                      {m.company_name && <p className="text-sm text-[#64748B] mb-1">{m.company_name}</p>}
                    </div>
                    {!m.resolved && (
                      <button
                        onClick={() => handleResolve(m.id)}
                        disabled={actionLoading === m.id}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-bold border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Marcar resuelto
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#64748B] mb-3 flex-wrap">
                    <a href={`mailto:${m.email}`} className="flex items-center gap-1 hover:text-[#1E8EA3]">
                      <EnvelopeIcon className="w-3.5 h-3.5" />{m.email}
                    </a>
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-[#1E8EA3]">
                        <PhoneIcon className="w-3.5 h-3.5" />{m.phone}
                      </a>
                    )}
                    <span>{new Date(m.created_at).toLocaleDateString("es-AR")}</span>
                  </div>
                  <p className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line bg-[#FAFBFD] rounded-xl px-4 py-3">{m.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
