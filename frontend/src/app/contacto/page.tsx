import Link from "next/link";
import { PhoneIcon, ChatBubbleLeftRightIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import ContactForm from "@/components/contact/ContactForm";

const WHATSAPP_NUMBER = "5492915089353"; // 291 508-9353 (Bahía Blanca)
const PHONE_DISPLAY = "+54 9 291 508-9353";

export default function ContactoPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Hero */}
        <div className="mb-12 max-w-2xl">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Contacto</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mb-4">
            Hablemos
          </h1>
          <p className="text-lg text-[#64748B] leading-relaxed">
            ¿Sos una empresa y querés publicar búsquedas, tenés dudas sobre tu cuenta, o encontraste algo
            que no funciona como debería? Escribinos.
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-8">
          {/* Columna izquierda: vías de contacto */}
          <div className="space-y-5">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] rounded-2xl p-6 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E6F4F7] flex items-center justify-center mb-4">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-[#1E8EA3]" />
              </div>
              <h2 className="font-display font-bold text-[#1C2230] mb-1">WhatsApp</h2>
              <p className="text-sm text-[#64748B] mb-3">La forma más rápida de contactarnos.</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3]">
                {PHONE_DISPLAY} <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </a>

            <a
              href={`tel:+${WHATSAPP_NUMBER}`}
              className="group block bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] rounded-2xl p-6 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E6F4F7] flex items-center justify-center mb-4">
                <PhoneIcon className="w-5 h-5 text-[#1E8EA3]" />
              </div>
              <h2 className="font-display font-bold text-[#1C2230] mb-1">Teléfono</h2>
              <p className="text-sm text-[#64748B] mb-3">Para consultas más extensas.</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3]">
                {PHONE_DISPLAY} <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </a>

            <section className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-6">
              <h2 className="font-display font-bold text-lg text-[#1C2230] mb-3">¿Sos una empresa?</h2>
              <p className="text-sm text-[#64748B] leading-relaxed mb-5">
                Registrate directamente en la plataforma. Tu cuenta pasa por una verificación manual
                del equipo de Talency antes de poder operar.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/register?type=company"
                  className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-5 py-3 text-sm transition-colors"
                >
                  Publicar un empleo <ArrowRightIcon className="w-4 h-4" />
                </Link>
                <a
                  href="https://talency.com.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-5 py-3 text-sm hover:bg-white transition-colors"
                >
                  Conocer Talency
                </a>
              </div>
            </section>
          </div>

          {/* Columna derecha: formulario */}
          <div>
            <h2 className="font-display font-bold text-xl text-[#1C2230] mb-4">Escribinos</h2>
            <ContactForm topic="general" />
          </div>
        </div>

      </div>
    </div>
  );
}
