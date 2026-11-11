import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { claveValida } from "@/vista-previa/clave";
import Recorrido from "@/vista-previa/recorrido/Recorrido";

// Recorrido guiado para Eugenia: lo nuevo de BBJobs, qué está listo y qué falta para prenderlo.
// Mismo candado que la vista previa: sin la clave, 404.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recorrido · BBJobs",
  robots: { index: false, follow: false, nocache: true },
};

export default async function Page({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  if (!claveValida(decodeURIComponent(clave))) notFound();
  return <Recorrido vistaPrevia={`/vista-previa/${clave}`} />;
}
