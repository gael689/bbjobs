// Inserta JSON-LD. JSON.stringify escapa comillas pero no "<": sin el reemplazo, un texto con
// "</script><script>..." cerraría el tag antes de tiempo (XSS). "<" decodifica de vuelta a
// "<", así que el JSON-LD queda idéntico para los crawlers. Ver SEGURIDAD-PLAN.md, bloque C.
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
