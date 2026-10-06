import type { Metadata } from "next";
import Link from "next/link";
import Section, { linkClass } from "@/components/legal/Section";
import ArrepentimientoForm from "@/components/legal/ArrepentimientoForm";

export const metadata: Metadata = {
  title: "Botón de arrepentimiento · BBJobs",
  description: "Arrepentite de una compra en BBJobs dentro de los 10 días corridos, sin dar motivos.",
};

// Botón de arrepentimiento (Ley 24.240 art. 34; Disposición 954/2025): accesible sin iniciar
// sesión, con link en el pie de todas las páginas públicas y código de trámite en el momento.
export default function ArrepentimientoPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Botón de arrepentimiento</h1>
          <p className="text-[#64748B]">
            Tenés <strong className="text-[#1C2230]">10 días corridos</strong> desde que compraste un servicio en BBJobs para
            arrepentirte, sin dar motivos y sin costo. No hace falta iniciar sesión.
          </p>
        </div>

        <ArrepentimientoForm />

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 space-y-6 mt-8">
          <Section title="Qué pasa después">
            <ul className="list-disc pl-5 space-y-1">
              <li>Al enviar el formulario te damos un <strong>código de trámite</strong>: guardalo, es tu constancia.</li>
              <li>El equipo de Talency te escribe al mail que dejaste y hace la devolución por el mismo medio de pago, desde Mercado Pago.</li>
              <li>El tiempo en que ves el dinero depende de tu medio de pago.</li>
            </ul>
          </Section>
          <Section title="Más información">
            <p>
              Las condiciones de los servicios pagos están en los{" "}
              <Link href="/terminos" className={linkClass}>Términos y condiciones</Link> (punto 6). Si tenés un problema con
              una compra, también podés reclamar ante{" "}
              <a href="https://www.argentina.gob.ar/defensadelconsumidor" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Defensa del Consumidor
              </a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
