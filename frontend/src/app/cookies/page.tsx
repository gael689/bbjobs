import type { Metadata } from "next";
import Link from "next/link";
import Section, { linkClass } from "@/components/legal/Section";
import ConfigurarCookiesButton from "@/components/consent/ConfigurarCookiesButton";

export const metadata: Metadata = {
  title: "Política de cookies — BBJobs",
  description: "Qué cookies usa BBJobs, para qué sirven, cuánto duran y cómo cambiar tu elección.",
  alternates: { canonical: "/cookies" },
};

// Página pedida en el Frente 3 (MAILS-SEO-IA-OCTUBRE-PLAN.md). Tiene que coincidir con la sección
// "11. Cookies" de /privacidad y con lo que hacen components/consent/ y lib/analytics.ts.
const NECESARIAS = [
  {
    nombre: "__session, __client_uat y otras que empiezan con __clerk o __client",
    quien: "Clerk (inicio de sesión)",
    para: "Mantener tu sesión abierta de forma segura y saber que sos vos.",
    dura: "Mientras dure tu sesión; se borran al cerrarla. Algunas recuerdan el dispositivo hasta 1 año.",
  },
  {
    nombre: "bbjobs_consent",
    quien: "BBJobs",
    para: "Recordar qué elegiste en el aviso de cookies, para no preguntarte en cada visita.",
    dura: "180 días.",
  },
];

const MEDICION = [
  {
    nombre: "bbjobs_vid",
    quien: "BBJobs (medición propia)",
    para: "Un número al azar para contar visitantes sin saber quién sos. Se crea sólo si aceptás y se borra si retirás el permiso.",
    dura: "13 meses.",
  },
  {
    nombre: "_ga",
    quien: "Google Analytics",
    para: "Distinguir visitas de forma anónima, para contar cuántas personas usan el sitio.",
    dura: "2 años.",
  },
  {
    nombre: "_ga_<código>",
    quien: "Google Analytics",
    para: "Recordar el estado de la visita (por ejemplo, si es la primera página que abrís).",
    dura: "2 años.",
  },
];

function Tabla({ filas }: { filas: typeof NECESARIAS }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[560px] text-left text-sm border-collapse">
        <thead>
          <tr className="text-[#1C2230]">
            <th scope="col" className="font-bold py-2 px-2 border-b border-[#DDE3EC]">Cookie</th>
            <th scope="col" className="font-bold py-2 px-2 border-b border-[#DDE3EC]">De quién</th>
            <th scope="col" className="font-bold py-2 px-2 border-b border-[#DDE3EC]">Para qué</th>
            <th scope="col" className="font-bold py-2 px-2 border-b border-[#DDE3EC]">Cuánto dura</th>
          </tr>
        </thead>
        <tbody className="text-[#1C2230]">
          {filas.map(f => (
            <tr key={f.nombre} className="align-top">
              <td className="py-2 px-2 border-b border-[#DDE3EC] font-mono text-xs break-words">{f.nombre}</td>
              <td className="py-2 px-2 border-b border-[#DDE3EC]">{f.quien}</td>
              <td className="py-2 px-2 border-b border-[#DDE3EC]">{f.para}</td>
              <td className="py-2 px-2 border-b border-[#DDE3EC]">{f.dura}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Política de cookies</h1>
          <p className="text-sm text-[#1C2230]">Complementa la <Link href="/privacidad" className={linkClass}>política de privacidad</Link>.</p>
        </div>

        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl px-6 py-4 mb-6 text-sm text-[#1C2230] flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p>
            <strong>Vos decidís.</strong> Las cookies de medición sólo se usan si las aceptás, y podés cambiar tu
            elección cuando quieras.
          </p>
          <ConfigurarCookiesButton className="shrink-0 rounded-lg bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold px-5 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E8EA3]">
            Cambiar mi elección
          </ConfigurarCookiesButton>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 space-y-8 text-[#1C2230]">

          <Section title="Qué es una cookie">
            <p>
              Es un archivo chico que un sitio guarda en tu navegador para recordar algo entre una página y otra: por
              ejemplo, que ya iniciaste sesión. Algunas son imprescindibles y otras son opcionales.
            </p>
          </Section>

          <Section title="Necesarias (siempre activas)">
            <p>
              Sin estas el sitio no funciona: no podrías iniciar sesión ni guardaríamos lo que elegiste en el aviso de
              cookies. Por eso no se pueden apagar desde el aviso; si las bloqueás en tu navegador, no vas a poder entrar
              a tu cuenta.
            </p>
            <Tabla filas={NECESARIAS} />
            <p>
              También guardamos en tu navegador algunos datos técnicos para que el sitio funcione (por ejemplo, si te
              estás registrando como postulante o como empresa). No se usan para medir ni se comparten.
            </p>
          </Section>

          <Section title="Medición (opcionales, sólo si las aceptás)">
            <p>
              Usamos <strong>Google Analytics</strong> para saber cuántas personas visitan BBJobs, qué secciones usan y
              qué búsquedas hacen, y así mejorar el sitio. Hasta que no las aceptás, Google Analytics{" "}
              <strong>ni siquiera se carga</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>No le mandamos tu nombre, tu mail, tu teléfono ni ningún dato de tu cuenta.</li>
              <li>Tenemos apagadas las funciones de publicidad y de &quot;señales de Google&quot;: no se usan para mostrarte anuncios.</li>
              <li>Google procesa estos datos en Estados Unidos, por cuenta nuestra.</li>
            </ul>
            <p>
              Con el mismo permiso, BBJobs también lleva su <strong>propia medición</strong>: qué páginas se visitan,
              qué se busca en el buscador de empleos, qué avisos se abren y cuántas postulaciones salen de ahí. Se guarda
              en los servidores de BBJobs, no en los de otra empresa, <strong>sin datos personales</strong>: ni tu
              nombre, ni tu mail, ni tu dirección IP, ni datos de tu cuenta. Para no contarte dos veces usamos la cookie{" "}
              <code>bbjobs_vid</code>, que es sólo un número al azar. Los registros se borran a los 13 meses.
            </p>
            <Tabla filas={MEDICION} />
          </Section>

          <Section title="Medición sin cookies (Vercel)">
            <p>
              Vercel, que publica el sitio, nos da un conteo de visitas por página <strong>sin usar cookies</strong> y sin
              guardar nada en tu navegador. No permite saber quién sos ni seguirte entre sitios, por eso no necesita tu
              permiso.
            </p>
          </Section>

          <Section title="Cómo cambiar tu elección">
            <p>
              Con el botón &quot;Cambiar mi elección&quot; de esta página o con el link <strong>Configurar cookies</strong>{" "}
              del pie de página. Si retirás el permiso, dejamos de medir en ese momento y borramos de tu navegador las
              cookies de Google Analytics y la de la medición propia (<code>bbjobs_vid</code>). Lo que ya se midió antes queda como estadística sin datos tuyos.
            </p>
            <p>
              También podés borrar o bloquear cookies desde la configuración de tu navegador. Ante cualquier duda,
              escribinos a <a href="mailto:privacidad@bbjobs.com.ar" className={linkClass}>privacidad@bbjobs.com.ar</a>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
