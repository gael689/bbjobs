"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UsersIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { Candidate } from "../types";

export default function AdminCandidatosPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    api.get("/admin/candidates").then(r => setCandidates(r.data)).catch(() => {});
  }, []);

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Candidatos</h1>
      <p className="text-[#64748B] text-sm mb-6">Candidatos registrados en la plataforma.</p>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#DDE3EC]/60">
        {candidates.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Sin candidatos registrados.</div>
        ) : (
          candidates.map(c => (
            <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFD] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E6F4F7] rounded-xl flex items-center justify-center shrink-0">
                  <UsersIcon className="w-5 h-5 text-[#1E8EA3]" />
                </div>
                <div>
                  <p className="font-bold text-[#1C2230]">{c.first_name} {c.last_name}</p>
                  <p className="text-sm text-[#64748B]">{c.phone}</p>
                </div>
              </div>
              {c.cv_file_url && (
                <a href={c.cv_file_url} target="_blank" rel="noreferrer"
                  className="text-xs font-bold text-[#1E8EA3] hover:underline flex items-center gap-1">
                  <DocumentTextIcon className="w-3.5 h-3.5" />
                  Ver CV
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
