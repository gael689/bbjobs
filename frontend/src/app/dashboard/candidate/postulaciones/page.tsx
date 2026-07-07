"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { APP_STATUS, type Application, type Job } from "../types";

export default function CandidatePostulacionesPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    api.get("/me/candidate/applications").then(r => setApplications(r.data)).catch(() => {});
    api.get("/jobs").then(r => setJobs(r.data)).catch(() => {});
  }, []);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Mis postulaciones</h1>
      <p className="text-[#64748B] text-sm mb-6">Seguimiento del estado de tus postulaciones.</p>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
        {applications.length === 0 ? (
          <div className="p-12 text-center">
            <PaperAirplaneIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-4" />
            <p className="text-[#64748B] font-medium mb-5">Aún no te postulaste a ninguna búsqueda.</p>
            <Link
              href="/dashboard/candidate/empleos"
              className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-full px-6 py-2.5 text-sm hover:bg-[#187B8E] transition-colors"
            >
              Explorar empleos
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]">
            {applications.map(app => {
              const job = jobs.find(j => j.id === app.job_posting_id);
              const st = APP_STATUS[app.status] || { label: app.status, cls: "bg-gray-100 text-gray-600" };
              return (
                <div key={app.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFD] transition-colors">
                  <div>
                    <p className="font-bold text-[#1C2230]">{job?.title || "Búsqueda"}</p>
                    <p className="text-sm text-[#64748B]">
                      {job?.company_legal_name_snapshot} · {new Date(app.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
