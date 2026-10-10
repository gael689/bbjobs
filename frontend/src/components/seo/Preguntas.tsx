import JsonLd from "./JsonLd";
import { faqSchema } from "@/lib/seo/schema";
import type { Pregunta } from "@/lib/seo/tipos";

// Preguntas frecuentes visibles + su FAQPage. Mismo estilo que las de PaginaListado.
export default function Preguntas({ preguntas, titulo = "Preguntas frecuentes", abiertas = true, ancho = false }: { preguntas: Pregunta[]; titulo?: string; abiertas?: boolean; ancho?: boolean }) {
  return (
    <section className={ancho ? "max-w-4xl mx-auto px-4 sm:px-6 mb-20" : "mb-12"} aria-labelledby="preguntas">
      <JsonLd data={faqSchema(preguntas)} />
      <h2 id="preguntas" className={ancho ? "font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-6" : "font-display font-bold text-xl text-[#1C2230] mb-4"}>{titulo}</h2>
      <div className="space-y-3">
        {preguntas.map((q) => (
          <details key={q.p} className="bg-white border border-[#DDE3EC] rounded-2xl p-5" open={abiertas}>
            <summary className="font-bold text-[#1C2230] cursor-pointer list-none">{q.p}</summary>
            <p className="text-sm text-[#1C2230] leading-relaxed mt-2">{q.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
