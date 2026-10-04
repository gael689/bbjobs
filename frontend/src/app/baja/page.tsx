"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EnvelopeIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";

const CATEGORIA: Record<string, string> = {
  postulaciones: "los avisos de postulaciones",
  busquedas: "los avisos de tus búsquedas",
  alertas: "las alertas y resúmenes",
  recordatorios: "los recordatorios",
  novedades: "las novedades y ofertas de BBJobs",
  admin: "los avisos del equipo",
  prospeccion: "los mails de BBJobs y Talency",
};

type Estado = "inicial" | "enviando" | "listo" | "invalido" | "no_disponible" | "error";

/**
 * Baja de mails en dos pasos: el link del mail trae acá y la baja recién se hace con el botón.
 * Nunca al cargar: los antivirus y escáneres de correo abren los links, y una baja automática
 * daría de baja a gente que nunca hizo click.
 */
function Baja() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const esEmpresa = params.get("tipo") === "empresa";
  const [estado, setEstado] = useState<Estado>(token ? "inicial" : "invalido");
  const [categoria, setCategoria] = useState<string | null>(null);

  async function confirmar() {
    setEstado("enviando");
    try {
      const ruta = esEmpresa ? "/email/unsubscribe-prospect" : "/email/unsubscribe";
      const r = await api.post<{ ok: boolean; category: string }>(ruta, null, { params: { t: token } });
      setCategoria(r.data.category);
      setEstado("listo");
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setEstado(status === 400 ? "invalido" : status === 404 ? "no_disponible" : "error");
    }
  }

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 shadow-sm">
      {estado === "listo" ? (
        <>
          <div className="w-11 h-11 rounded-xl bg-[#E6F4F7] flex items-center justify-center mb-4">
            <CheckCircleIcon className="w-6 h-6 text-[#187B8E]" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-[#1C2230] mb-2">Listo, te dimos de baja</h1>
          <p className="text-[#1C2230]">
            No vas a recibir más {CATEGORIA[categoria ?? ""] ?? "estos mails"}.
            {!esEmpresa && " Si cambiás de idea, lo podés volver a activar desde Mi cuenta."}
          </p>
        </>
      ) : estado === "invalido" ? (
        <>
          <h1 className="font-display font-extrabold text-2xl text-[#1C2230] mb-2">El link no es válido</h1>
          <p className="text-[#1C2230]">
            Puede que esté incompleto. Probá abrirlo de nuevo desde el mail o escribinos desde{" "}
            <Link href="/contacto" className="font-bold text-[#187B8E] underline">Contacto</Link>.
          </p>
        </>
      ) : estado === "no_disponible" ? (
        <>
          <h1 className="font-display font-extrabold text-2xl text-[#1C2230] mb-2">Esta función todavía no está disponible</h1>
          <p className="text-[#1C2230]">
            Si querés dejar de recibir mails, escribinos desde{" "}
            <Link href="/contacto" className="font-bold text-[#187B8E] underline">Contacto</Link>.
          </p>
        </>
      ) : (
        <>
          <div className="w-11 h-11 rounded-xl bg-[#E6F4F7] flex items-center justify-center mb-4">
            <EnvelopeIcon className="w-6 h-6 text-[#187B8E]" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-[#1C2230] mb-2">¿Querés dejar de recibir estos mails?</h1>
          <p className="text-[#1C2230] mb-6">
            {esEmpresa
              ? "Tu empresa no va a recibir más mails de BBJobs ni de Talency."
              : "Vas a dejar de recibir este tipo de avisos. Los de tu cuenta y tus pagos siguen llegando."}
          </p>
          {estado === "error" && (
            <p className="text-sm text-red-600 mb-3">No pudimos completar la baja. Probá de nuevo en un rato.</p>
          )}
          <button
            onClick={confirmar}
            disabled={estado === "enviando"}
            className="bg-[#187B8E] hover:bg-[#126474] text-white font-bold px-6 py-3 rounded-xl disabled:opacity-60"
          >
            {estado === "enviando" ? "Dando de baja..." : "Sí, dar de baja"}
          </button>
        </>
      )}
    </div>
  );
}

export default function BajaPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        <Suspense fallback={<div className="text-[#1C2230]">Cargando…</div>}>
          <Baja />
        </Suspense>
      </div>
    </div>
  );
}
