import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import ContactForm from "@/components/contact/ContactForm";

// Mismo número que /contacto: Talency responde por WhatsApp.
const WHATSAPP_NUMBER = "5492915089353";
const PHONE_DISPLAY = "+54 9 291 508-9353";

// Formulario de consulta por el servicio de selección (ancla #consulta). Usa el formulario de
// contacto con el tema "seleccion": llega al panel de mensajes del admin y dispara generate_lead.
export default function ConsultaSeleccion({ sector = "", titulo = "Contanos qué puesto necesitás" }: { sector?: string; titulo?: string }) {
  return (
    <section id="consulta" className="scroll-mt-32 max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby="consulta-titulo">
      <h2 id="consulta-titulo" className="font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-2">{titulo}</h2>
      <p className="text-lg text-[#1C2230] leading-snug mb-6">Nombre, teléfono y qué buscás. Talency te responde por WhatsApp o por teléfono.</p>
      <ContactForm topic="seleccion" sectorInicial={sector} />
      <p className="text-sm text-[#1C2230] mt-5 flex items-center gap-2 flex-wrap">
        <ChatBubbleLeftRightIcon className="w-4 h-4 text-[#1E8EA3]" aria-hidden />
        ¿Preferís escribir directo?
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="font-bold text-[#187B8E] hover:underline">
          WhatsApp {PHONE_DISPLAY}
        </a>
      </p>
    </section>
  );
}
