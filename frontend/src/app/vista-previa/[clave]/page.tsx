import Link from "next/link";
import { notFound } from "next/navigation";
import avisos from "@/vista-previa/datos/avisos.json";
import ia from "@/vista-previa/datos/ia.json";
import VistaPrevia from "@/vista-previa/VistaPrevia";
import { claveValida } from "@/vista-previa/clave";

// Los datos se leen acá, en el servidor: sin la clave correcta nunca viajan al navegador.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  if (!claveValida(decodeURIComponent(clave))) notFound();
  return (
    <>
      <div className="border-b border-border bg-primary-light">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
          <span className="text-text">
            ¿Primera vez acá? Hay un recorrido guiado, paso a paso, de todo lo nuevo.
          </span>
          <Link
            href={`/vista-previa/${clave}/recorrido`}
            className="rounded-full bg-primary px-4 py-1.5 font-semibold text-white transition hover:bg-primary-hover"
          >
            Ver el recorrido →
          </Link>
        </div>
      </div>
      <VistaPrevia
        etapas={avisos.etapas}
        avisos={avisos.avisos}
        sinMail={avisos.sin_mail}
        preguntas={avisos.preguntas}
        ia={ia}
      />
    </>
  );
}
