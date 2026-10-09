import JsonLd from "./JsonLd";
import { faqSchema } from "@/lib/seo/schema";
import type { Pregunta } from "@/lib/seo/tipos";

// Preguntas frecuentes visibles + su FAQPage. Mismo estilo que las de PaginaListado.
export default function Preguntas({ preguntas, titulo = "Preguntas frecuentes" }: { preguntas: Pregunta[]; titulo?: string }) {
  return (
    <section className="mb-12" aria-labelledby="preguntas">
      <JsonLd data={faqSchema(preguntas)} />
      <h2 id="preguntas" className="font-display font-bold text-xl text-[#1C2230] mb-4">{titulo}</h2>
      <div className="space-y-3">
        {preguntas.map((q) => (
          <details key={q.p} className="bg-white border border-[#DDE3EC] rounded-2xl p-5" open>
            <summary className="font-bold text-[#1C2230] cursor-pointer list-none">{q.p}</summary>
            <p className="text-sm text-[#1C2230] leading-relaxed mt-2">{q.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
