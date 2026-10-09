import { CheckIcon } from "@heroicons/react/24/outline";
import type { Paso } from "@/lib/seo/seleccion";
import { COMPARACION } from "@/lib/seo/seleccion";

// Pasos numerados (el proceso de selección o cómo publicar).
export function Pasos({ pasos, titulo, id }: { pasos: Paso[]; titulo: string; id: string }) {
  return (
    <section className="mb-12" aria-labelledby={id}>
      <h2 id={id} className="font-display font-bold text-xl text-[#1C2230] mb-4">{titulo}</h2>
      <ol className="grid sm:grid-cols-2 gap-3">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex gap-4">
            <span className="shrink-0 w-8 h-8 rounded-full bg-[#E6F4F7] text-[#187B8E] text-sm font-bold flex items-center justify-center" aria-hidden>
              {i + 1}
            </span>
            <div>
              <h3 className="font-display font-bold text-[#1C2230] mb-1">{p.titulo}</h3>
              <p className="text-sm text-[#1C2230] leading-relaxed">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Lista con tildes (para quién es, perfiles, qué evaluar).
export function ListaTildes({ items, titulo, id }: { items: string[]; titulo: string; id: string }) {
  return (
    <section className="bg-white border border-[#DDE3EC] rounded-2xl p-6 sm:p-8 mb-12" aria-labelledby={id}>
      <h2 id={id} className="font-display font-bold text-xl text-[#1C2230] mb-4">{titulo}</h2>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-[#1C2230] leading-snug">
            <span className="w-5 h-5 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 mt-px" aria-hidden>
              <CheckIcon className="w-3 h-3 text-[#1E8EA3] stroke-[3]" />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Publicar por tu cuenta vs. que Talency se encargue: dos tarjetas con los mismos renglones.
export function Comparacion() {
  const columnas = [
    { titulo: "Publicás vos en BBJobs", campo: "publicar" as const, destacada: false },
    { titulo: "Talency se encarga", campo: "talency" as const, destacada: true },
  ];
  return (
    <section className="mb-12" aria-labelledby="comparacion">
      <h2 id="comparacion" className="font-display font-bold text-xl text-[#1C2230] mb-2">Publicar por tu cuenta o que Talency se encargue</h2>
      <p className="text-[#1C2230] leading-relaxed mb-5">Las dos opciones conviven: podés empezar por una y pasar a la otra cuando lo necesites.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {columnas.map((c) => (
          <div
            key={c.campo}
            className={`bg-white rounded-2xl p-6 ${c.destacada ? "border-2 border-[#1E8EA3]" : "border border-[#DDE3EC]"}`}
          >
            <h3 className="font-display font-bold text-lg text-[#1C2230] mb-4">{c.titulo}</h3>
            <dl className="divide-y divide-[#DDE3EC]">
              {COMPARACION.map((fila) => (
                <div key={fila.aspecto} className="py-2.5 flex justify-between gap-4 text-sm">
                  <dt className="font-bold text-[#1C2230]">{fila.aspecto}</dt>
                  <dd className="text-[#1C2230] text-right">{fila[c.campo]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
