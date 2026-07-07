"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { WrenchScrewdriverIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { Skill } from "../types";

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  function fetchSkills() {
    setLoading(true);
    api.get("/admin/skills/pending")
      .then(r => setSkills(r.data))
      .catch(() => toast("Error al cargar skills", "error"))
      .finally(() => setLoading(false));
  }

  function toast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function handleSkillAction(skillId: string, action: "approve" | "reject") {
    setActionLoading(skillId + action);
    try {
      await api.patch(`/admin/skills/${skillId}`, { action });
      toast(action === "approve" ? "Skill aprobado" : "Skill rechazado");
      setSkills(prev => prev.filter(s => s.id !== skillId));
    } catch {
      toast("Error al procesar", "error");
    } finally {
      setActionLoading(null);
    }
  }

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

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Skills pendientes</h1>
      <p className="text-[#64748B] text-sm mb-6">Habilidades sugeridas esperando aprobación.</p>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : skills.length === 0 ? (
          <div className="p-12 text-center">
            <WrenchScrewdriverIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-3" />
            <p className="text-[#64748B]">No hay skills pendientes de revisión.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]/60">
            {skills.map(skill => (
              <div key={skill.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFD] transition-colors">
                <div>
                  <p className="font-bold text-[#1C2230]">{skill.name}</p>
                  <p className="text-xs text-[#64748B]">{new Date(skill.created_at).toLocaleDateString("es-AR")}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSkillAction(skill.id, "reject")}
                    disabled={!!actionLoading}
                    className="text-sm font-bold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleSkillAction(skill.id, "approve")}
                    disabled={!!actionLoading}
                    className="text-sm font-bold bg-[#1E8EA3] text-white px-3 py-1.5 rounded-lg hover:bg-[#187B8E] transition-colors disabled:opacity-60"
                  >
                    {actionLoading === skill.id + "approve" ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : "Aprobar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
