import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import avisos from "@/vista-previa/datos/avisos.json";
import ia from "@/vista-previa/datos/ia.json";
import VistaPrevia from "@/vista-previa/VistaPrevia";

// La clave vive en la variable VISTA_PREVIA_CLAVE del hosting. Sin variable o con otra clave
// responde 404, como si la página no existiera. Los datos se leen acá, en el servidor: sin la
// clave correcta nunca viajan al navegador.
export const dynamic = "force-dynamic";

function claveValida(recibida: string): boolean {
  const esperada = process.env.VISTA_PREVIA_CLAVE;
  if (!esperada || esperada.length < 16) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function Page({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  if (!claveValida(decodeURIComponent(clave))) notFound();
  return <VistaPrevia avisos={avisos.avisos} sinMail={avisos.sin_mail} ia={ia} />;
}
