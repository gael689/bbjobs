import Link from "next/link";
import Section, { linkClass } from "@/components/legal/Section";
import { LEGAL_VERSION, LEGAL_VIGENTE_DESDE } from "@/lib/legal";

// Versión 2.0 (06/10/2026): suma la Base de Talento, los servicios pagos, el arrepentimiento y el
// registro de aceptación, y saca la "renuncia a cualquier otro fuero" (abusiva frente a un
// consumidor, Ley 24.240 art. 37).
export default function TerminosPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Términos y condiciones de uso</h1>
          <p className="text-sm text-[#64748B]">Versión {LEGAL_VERSION} · Vigente desde el {LEGAL_VIGENTE_DESDE}</p>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 space-y-8 text-[#1C2230]">

          <Section title="1. Aceptación">
            <p>
              Al registrarte o usar BBJobs (&quot;la plataforma&quot;) aceptás estos términos y la{" "}
              <Link href="/privacidad" className={linkClass}>Política de privacidad</Link>. Si no estás de acuerdo, no uses
              la plataforma. Guardamos qué versión aceptaste y cuándo.
            </p>
            <p>
              BBJobs es administrada por <strong>Talency</strong>, consultora de recursos humanos de Bahía Blanca, provincia de
              Buenos Aires, República Argentina.
            </p>
          </Section>

          <Section title="2. Qué es BBJobs">
            <p>
              Una plataforma que conecta empresas y postulantes de Bahía Blanca y la región. Las empresas publican búsquedas y
              los postulantes se postulan. Además:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Base de Talento:</strong> las empresas verificadas pueden encontrar a los postulantes que <strong>lo autorizaron</strong>, aunque no se hayan postulado a su búsqueda.</li>
              <li><strong>Servicios pagos para empresas:</strong> avisos destacados y packs de contactos de la Base de Talento.</li>
            </ul>
            <p>
              BBJobs es un intermediario: <strong>no es parte de la relación laboral</strong> entre la empresa y el postulante,
              y no garantiza que una búsqueda se cubra ni que un postulante consiga empleo.
            </p>
          </Section>

          <Section title="3. Registro y cuentas">
            <ul className="list-disc pl-5 space-y-1">
              <li>Para registrarte tenés que tener 18 años o más y cargar datos verdaderos y actualizados.</li>
              <li>Sos responsable de cuidar el acceso a tu cuenta.</li>
              <li>
                Las cuentas de empresa necesitan una verificación manual del equipo de Talency antes de publicar. Talency puede
                rechazar o suspender cuentas que no cumplan los requisitos o que usen mal la plataforma.
              </li>
              <li>Los postulantes son responsables de que lo que cargan en su perfil y su CV sea verdadero.</li>
              <li>Podés borrar tu cuenta cuando quieras desde Mi cuenta.</li>
            </ul>
          </Section>

          <Section title="4. Uso permitido y prohibido">
            <p>No se puede usar la plataforma para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Publicar avisos falsos, engañosos o que incumplan la legislación laboral argentina.</li>
              <li>
                <strong>Discriminar</strong> por género, edad, origen étnico, nacionalidad, religión, orientación sexual, estado
                civil, aspecto físico, salud, discapacidad, ideas políticas o gremiales u otra condición protegida por la ley
                (Ley 23.592 y Ley de Contrato de Trabajo). Esto incluye pedir esas condiciones como requisito en un aviso.
              </li>
              <li>Recopilar datos de otros usuarios con fines comerciales o no autorizados.</li>
              <li>Intentar entrar sin permiso a sistemas o cuentas ajenas.</li>
              <li>Publicar contenido ofensivo, fraudulento o que viole derechos de terceros.</li>
            </ul>
          </Section>

          <Section title="5. Qué puede hacer una empresa con los datos de los postulantes">
            <p>
              Cuando una empresa ve el perfil, el CV o los datos de contacto de un postulante (porque se postuló o porque lo
              desbloqueó en la Base de Talento):
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Los puede usar <strong>sólo para procesos de selección</strong>: ese o para ofrecerle otro puesto de trabajo.</li>
              <li><strong>No</strong> los puede vender, ceder, publicar ni usar para publicidad, ni cargarlos en otra base para otros fines.</li>
              <li>Tiene que cuidarlos, borrarlos cuando ya no los necesite y responder ella misma si el postulante le pide acceso o borrado de lo que guardó.</li>
              <li>Desde que los descarga o los copia fuera de BBJobs, <strong>es responsable de ese tratamiento</strong> según la Ley 25.326.</li>
            </ul>
          </Section>

          <Section title="6. Servicios pagos para empresas">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Los <strong>avisos destacados</strong> y los <strong>packs de la Base de Talento</strong> se pagan por Mercado
                Pago. El precio vigente está en <Link href="/planes" className={linkClass}>Planes y precios</Link>.
              </li>
              <li>El servicio se activa <strong>cuando Mercado Pago nos confirma el pago</strong>, no antes.</li>
              <li>Un aviso destacado se mantiene destacado mientras la búsqueda esté activa.</li>
              <li>Un pack da una cantidad de contactos que se descuentan al desbloquear cada perfil. Los contactos no vencen.</li>
              <li>Un desbloqueo ya hecho no se devuelve, aunque después el postulante borre su cuenta o retire su autorización.</li>
              <li>Si un pago se cobra dos veces por error, lo devolvemos.</li>
              <li>
                <strong>Arrepentimiento:</strong> tenés <strong>10 días corridos</strong> desde la compra para arrepentirte, sin
                dar motivos, desde el <Link href="/arrepentimiento" className={linkClass}>Botón de arrepentimiento</Link> que
                está en el pie de todas las páginas. Te damos un código de trámite en el momento y la devolución se hace por
                el mismo medio de pago.
              </li>
            </ul>
          </Section>

          <Section title="7. Base de Talento">
            <ul className="list-disc pl-5 space-y-1">
              <li>Sólo aparecen los postulantes que <strong>lo autorizaron</strong>; lo pueden retirar cuando quieran y dejan de aparecer desde ese momento.</li>
              <li>Antes del desbloqueo, la empresa ve un perfil <strong>sin nombre ni datos de contacto</strong>.</li>
              <li>El postulante puede ver en su panel qué empresas desbloquearon su perfil.</li>
            </ul>
          </Section>

          <Section title="8. Privacidad y datos personales">
            <p>
              El tratamiento de datos personales se rige por la <strong>Ley 25.326</strong> y la{" "}
              <Link href="/privacidad" className={linkClass}>Política de privacidad</Link>.
            </p>
          </Section>

          <Section title="9. Propiedad intelectual">
            <p>
              Todo el contenido de la plataforma (diseño, código, textos, logos) es de Talency o de quienes le dieron licencia.
              No se puede reproducir, distribuir ni modificar sin autorización expresa y por escrito. Lo que cargás (CV,
              descripción de la empresa, avisos) sigue siendo tuyo; nos autorizás a mostrarlo y procesarlo sólo para prestar
              el servicio.
            </p>
          </Section>

          <Section title="10. Limitación de responsabilidad">
            <p>
              BBJobs actúa como intermediario entre empresas y postulantes. Talency verifica a las empresas para reducir
              riesgos, pero no puede garantizar que toda la información que cargan los usuarios sea verdadera ni que un
              postulante sea idóneo. Talency no es responsable por la relación laboral entre las partes, ni por las decisiones
              que tome una empresa sobre un postulante, ni por el contenido de los avisos que publican las empresas. Nada de
              esto limita los derechos que te da la ley si sos consumidor.
            </p>
          </Section>

          <Section title="11. Cambios en estos términos">
            <p>
              Podemos cambiar estos términos. Si el cambio es importante, te avisamos por la plataforma con al menos 15 días
              de anticipación, y la próxima vez que entres después de esa fecha te vamos a pedir que aceptes la versión nueva.
              Si no estás de acuerdo, podés borrar tu cuenta en cualquier momento.
            </p>
          </Section>

          <Section title="12. Ley aplicable y jurisdicción">
            <p>
              Estos términos se rigen por las leyes de la República Argentina. Para cualquier conflicto son competentes los
              tribunales ordinarios de Bahía Blanca, provincia de Buenos Aires. Si sos consumidor, también podés reclamar ante
              los tribunales de tu domicilio y ante la autoridad de Defensa del Consumidor, como prevé la Ley 24.240.
            </p>
          </Section>

          <Section title="13. Contacto">
            <p>
              Consultas sobre estos términos:{" "}
              <a href="mailto:info@bbjobs.com.ar" className={linkClass}>info@bbjobs.com.ar</a>. Datos personales:{" "}
              <a href="mailto:privacidad@bbjobs.com.ar" className={linkClass}>privacidad@bbjobs.com.ar</a>. Arrepentimiento
              de una compra: <Link href="/arrepentimiento" className={linkClass}>Botón de arrepentimiento</Link>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
