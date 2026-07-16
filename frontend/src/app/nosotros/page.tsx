import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function NosotrosPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Hero */}
        <div className="mb-12">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Quiénes somos</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mb-4">
            El empleo local, <br className="hidden sm:block" />
            <span className="text-[#1E8EA3]">conectado desde adentro</span>
          </h1>
          <p className="text-lg text-[#64748B] leading-relaxed">
            BBJobs es el portal de empleos creado para Bahía Blanca y la región, donde las empresas verificadas
            y los candidatos locales se encuentran en un mismo espacio seguro y transparente.
          </p>
        </div>

        {/* Tarjetas de contenido */}
        <div className="space-y-8">

          <section className="bg-white border border-[#DDE3EC] rounded-2xl p-8">
            <h2 className="font-display font-bold text-xl text-[#1C2230] mb-3">Nuestra misión</h2>
            <p className="text-[#64748B] leading-relaxed">
              Creemos que el mercado laboral local merece su propia plataforma: una pensada para la escala,
              el ritmo y las necesidades de Bahía Blanca. BBJobs nació para eliminar la dispersión de
              búsquedas en redes sociales y grupos de WhatsApp, y reemplazarla con un sistema profesional
              donde las empresas puedan encontrar talento real y los candidatos puedan postularse con dignidad,
              sin exponer sus datos a desconocidos.
            </p>
          </section>

          <section className="bg-white border border-[#DDE3EC] rounded-2xl p-8">
            <h2 className="font-display font-bold text-xl text-[#1C2230] mb-3">Una iniciativa de Talency</h2>
            <p className="text-[#64748B] leading-relaxed mb-4">
              BBJobs es un producto de{" "}
              <a href="https://talency.com.ar" target="_blank" rel="noopener noreferrer"
                className="text-[#1E8EA3] font-semibold hover:underline">Talency</a>,
              la consultora de recursos humanos bahiense con años de experiencia conectando empresas
              locales con profesionales de la región. Toda empresa que publica en BBJobs pasa por un
              proceso de verificación manual realizado por el equipo de Talency, garantizando que
              los candidatos solo interactúen con empleadores reales y confiables.
            </p>
            <p className="text-[#64748B] leading-relaxed">
              Talency opera bajo estrictos estándares profesionales y es la responsable de la
              administración y moderación de la plataforma.
            </p>
          </section>

          <section className="bg-white border border-[#DDE3EC] rounded-2xl p-8">
            <h2 className="font-display font-bold text-xl text-[#1C2230] mb-3">Cómo funciona</h2>
            <div className="space-y-4">
              {[
                {
                  n: "01",
                  title: "Las empresas se verifican",
                  body: "Ninguna empresa puede publicar vacantes sin pasar por la revisión del equipo de Talency. Esto protege a los candidatos de avisos falsos o engañosos.",
                },
                {
                  n: "02",
                  title: "Los candidatos crean su perfil una sola vez",
                  body: "CV, experiencia, formación y habilidades se cargan una vez y se reutilizan en cada postulación. Sin formularios repetitivos.",
                },
                {
                  n: "03",
                  title: "Todo queda dentro de la plataforma",
                  body: "No se publican mails ni teléfonos. Las postulaciones, el estado de cada proceso y la comunicación ocurren dentro de BBJobs.",
                },
                {
                  n: "04",
                  title: "La privacidad es el centro",
                  body: "El perfil de un candidato solo es visible para las empresas verificadas a las que decidió postularse. Nadie más accede a esa información.",
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-[#E6F4F7] text-[#1E8EA3] text-xs font-bold flex items-center justify-center">{n}</span>
                  <div>
                    <p className="font-bold text-sm text-[#1C2230] mb-1">{title}</p>
                    <p className="text-sm text-[#64748B] leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-[#DDE3EC] rounded-2xl p-8">
            <h2 className="font-display font-bold text-xl text-[#1C2230] mb-3">Desarrollo y tecnología</h2>
            <p className="text-[#64748B] leading-relaxed">
              BBJobs fue diseñada y desarrollada por{" "}
              <a href="https://gaelgonzalez.com.ar" target="_blank" rel="noopener noreferrer"
                className="text-[#1E8EA3] font-semibold hover:underline">Gael González</a>,
              desarrollador full-stack bahiense especializado en productos digitales.
              La plataforma está construida con tecnologías modernas orientadas a la performance,
              la seguridad y la escalabilidad, pensadas para crecer junto al mercado laboral local.
            </p>
          </section>

          <section className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-8">
            <h2 className="font-display font-bold text-xl text-[#1C2230] mb-3">¿Querés sumarte?</h2>
            <p className="text-[#64748B] leading-relaxed mb-6">
              Si sos una empresa de la región y querés publicar tus búsquedas, o si estás buscando trabajo
              y querés que las empresas te encuentren, empezá hoy.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/register?type=company"
                className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-5 py-3 text-sm transition-colors"
              >
                Publicar búsqueda <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <Link
                href="/register?type=candidate"
                className="inline-flex items-center justify-center gap-2 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-5 py-3 text-sm hover:bg-white transition-colors"
              >
                Subir mi CV
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
