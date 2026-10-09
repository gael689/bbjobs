import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import ContactForm from "@/components/contact/ContactForm";

// Mismo número que /contacto: Talency responde por WhatsApp.
const WHATSAPP_NUMBER = "5492915089353";
const PHONE_DISPLAY = "+54 9 291 508-9353";

// Formulario de consulta por el servicio de selección (ancla #consulta). Usa el formulario de
// contacto con el tema "seleccion": llega al panel de mensajes del admin y dispara generate_lead.
export default function ConsultaSeleccion({ sector = "", titulo = "Consultá por tu búsqueda" }: { sector?: string; titulo?: string }) {
  return (
    <section id="consulta" className="scroll-mt-32 mb-12" aria-labelledby="consulta-titulo">
      <h2 id="consulta-titulo" className="font-display font-bold text-2xl text-[#1C2230] mb-2">{titulo}</h2>
      <p className="text-[#1C2230] leading-relaxed mb-5">
        Contanos qué puesto necesitás cubrir. Sólo hacen falta tu nombre, un teléfono y un mensaje; Talency te responde por
        WhatsApp o por teléfono.
      </p>
      <ContactForm topic="seleccion" sectorInicial={sector} />
      <p className="text-sm text-[#1C2230] mt-4 flex items-center gap-2 flex-wrap">
        <ChatBubbleLeftRightIcon className="w-4 h-4 text-[#1E8EA3]" aria-hidden />
        ¿Preferís escribir directo?
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="font-bold text-[#1E8EA3] hover:underline">
          WhatsApp {PHONE_DISPLAY}
        </a>
      </p>
    </section>
  );
}
