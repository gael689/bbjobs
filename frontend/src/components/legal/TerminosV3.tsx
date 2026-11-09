import Link from "next/link";
import Section, { linkClass } from "@/components/legal/Section";
import { LEGAL_ENCABEZADO } from "@/lib/legal";

// Versión 3.0 (28/10/2026): la 2.0 más los módulos nuevos (IA, mails, Revisión de CV, observaciones
// de las empresas, "Vieron tu CV" y aviso de otro proceso). Sólo con la compuerta abierta.
// Revisada contra la Ley 24.240, el Código Civil y Comercial (arts. 1092–1122), la Res. SCI 424/2020
// y la Ley 23.592: ver LEGAL-PLAN.md §11.
export default function TerminosV3() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Términos y condiciones de uso</h1>
          <p className="text-sm text-[#64748B]">{LEGAL_ENCABEZADO}</p>
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
              <li><strong>Recomendaciones con inteligencia artificial</strong> para ordenar postulantes (punto 8).</li>
              <li><strong>Avisos y búsquedas recomendadas por mail</strong> (punto 10).</li>
              <li><strong>Revisión de CV:</strong> un servicio pago para postulantes que presta Talency (punto 11).</li>
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
                civil, aspecto físico, salud, discapacidad, embarazo, ideas políticas o gremiales u otra condición protegida
                por la ley (Ley 23.592 y Ley de Contrato de Trabajo). Esto incluye pedir esas condiciones como requisito en un
                aviso y usarlas como motivo en una observación.
              </li>
              <li>Recopilar datos de otros usuarios con fines comerciales o no autorizados.</li>
              <li>Intentar entrar sin permiso a sistemas o cuentas ajenas.</li>
              <li>Publicar contenido ofensivo, fraudulento o que viole derechos de terceros.</li>
              <li>
                Cargar en el CV o en el perfil texto escondido o instrucciones dirigidas a sistemas automáticos para alterar el
                orden de las recomendaciones. Si lo detectamos, ese perfil se ordena sin inteligencia artificial y podemos
                suspender la cuenta.
              </li>
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
              <li>
                Lo que le indique el aviso de otro proceso (punto 9) es <strong>sólo informativo</strong>: no lo puede usar para
                descartar a nadie de forma automática ni comunicárselo a terceros.
              </li>
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

          <Section title="8. Recomendaciones con inteligencia artificial">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Las recomendaciones <strong>son orientativas</strong>. Ordenan postulantes y explican por qué, pero{" "}
                <strong>no deciden nada</strong>: no descartan, no ocultan y no cambian el estado de ninguna postulación. La
                decisión de avanzar o no con alguien <strong>es siempre de una persona de la empresa</strong>, que es
                responsable de ella.
              </li>
              <li>La empresa ve <strong>siempre a todos</strong> sus postulantes, tengan o no puntaje.</li>
              <li>
                El sistema <strong>no usa</strong> edad, género, foto, nombre, estado civil, nacionalidad, religión ni salud.
                Si una búsqueda pide alguno de esos datos, ese requisito no se usa para ordenar y se lo indicamos a la empresa.
              </li>
              <li>
                Los motivos se basan en lo que el postulante cargó y pueden tener errores u omisiones: la empresa tiene que
                mirar el perfil y el CV antes de decidir.
              </li>
              <li>
                Un postulante puede pedir que su perfil <strong>no se use</strong> para recomendaciones (Política de
                privacidad, punto 7). Esa elección no lo perjudica: sus postulaciones aparecen igual, sin puntaje.
              </li>
              <li>Talency puede apagar las recomendaciones en cualquier momento.</li>
            </ul>
          </Section>

          <Section title="9. Observaciones, &quot;Vieron tu CV&quot; y aviso de otro proceso">
            <p><strong>Para empresas:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Podés registrar <strong>observaciones internas</strong> sobre las personas que participan en tus procesos.
                Son de tu empresa: no las ve el postulante ni otras empresas, y te sirven en cualquier búsqueda futura con esa
                persona. El equipo de Talency las puede leer, sin modificarlas, para dar soporte, controlar el buen uso de la
                plataforma y responder pedidos de acceso del postulante (Ley 25.326, art. 14).
              </li>
              <li>
                <strong>Sos responsable del contenido de tus observaciones.</strong> Escribí sólo hechos del proceso de
                selección. No incluyas motivos discriminatorios (edad, género, estado civil, salud, embarazo, nacionalidad,
                religión, aspecto u otros protegidos por la Ley 23.592 y la Ley de Contrato de Trabajo) ni datos de salud u
                otros datos sensibles. Usarlas mal es motivo de suspensión de la cuenta.
              </li>
              <li>
                La primera vez que abrís el perfil o el CV de un postulante desde una postulación, <strong>le avisamos que lo
                viste</strong> y la postulación pasa a &quot;Perfil revisado&quot;.
              </li>
              <li>
                Si está activo, al mirar una postulación podés ver cuántas búsquedas de <strong>otras</strong> empresas tienen
                a esa persona en una etapa avanzada en los últimos 90 días, sin decir cuáles. No aparece si la persona se
                opuso.
              </li>
            </ul>
            <p>
              <strong>Para postulantes:</strong> te vamos a avisar cuando una empresa vea tu CV. Lo que una empresa decida
              sobre tu postulación es responsabilidad de esa empresa.
            </p>
          </Section>

          <Section title="10. Mails">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Te mandamos mails sobre tu cuenta, tus postulaciones o tus búsquedas, y búsquedas que encajan con tu perfil. Te podés dar de
                baja de cada tipo desde el pie del mail o desde Mi cuenta, <strong>salvo los de cuenta y pagos</strong>, que
                son necesarios para el servicio.
              </li>
              <li>
                Los mails de <strong>novedades</strong> (ofertas de BBJobs y Talency) a postulantes sólo salen si los
                aceptaste. A las empresas registradas les podemos mandar novedades del servicio, con la baja en cada mail.
              </li>
              <li>
                El detalle está en la <Link href="/privacidad" className={linkClass}>Política de privacidad</Link>, punto 8.
              </li>
            </ul>
          </Section>

          <Section title="11. Revisión de CV">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Qué es.</strong> Un servicio pago, de una sola vez, en el que una persona del equipo de Talency revisa
                tu CV y te da una devolución. Lo que incluye se detalla en la pantalla de compra antes de pagar.
              </li>
              <li>
                <strong>Precio.</strong> El que se muestra antes de pagar, que es el <strong>precio final</strong>. Se paga por
                Mercado Pago.
              </li>
              <li><strong>Quién puede comprarla.</strong> Postulantes con perfil y CV cargado. Una revisión abierta por vez.</li>
              <li>
                <strong>Cómo se presta.</strong> Por fuera de la plataforma, por el canal que elijas: <strong>WhatsApp o
                mail</strong>. Al comprar, autorizás a Talency a contactarte por ese canal. Se revisa el CV que tenías cargado
                al momento de pagar. Para prestarlo, Talency ve tu nombre, el canal y el dato de contacto que elegiste, lo que
                nos contaste sobre para qué querés el CV y tu CV. <strong>No interviene ninguna inteligencia artificial.</strong>
              </li>
              <li>
                <strong>Qué no incluye.</strong> La Revisión de CV <strong>no garantiza</strong> que consigas empleo, entrevistas
                ni que una empresa avance con tu postulación. No cambia en nada cómo te ven las empresas en BBJobs.
              </li>
              <li>
                <strong>Arrepentimiento.</strong> Tenés <strong>10 días corridos</strong> desde la compra para arrepentirte, sin
                dar motivos y sin costo, desde el <Link href="/arrepentimiento" className={linkClass}>Botón de
                arrepentimiento</Link> que está en el pie de todas las páginas. Te devolvemos el total por el mismo medio de
                pago, <strong>aunque la revisión ya se haya hecho</strong>.
              </li>
              <li>
                <strong>Si no podemos prestarlo</strong>, por el motivo que sea, te devolvemos el total. Las devoluciones se
                hacen desde Mercado Pago y pueden tardar lo que tarde tu medio de pago.
              </li>
              <li>
                <strong>Reclamos.</strong> Escribinos a{" "}
                <a href="mailto:info@bbjobs.com.ar" className={linkClass}>info@bbjobs.com.ar</a>. Como consumidor, también
                podés reclamar ante Defensa del Consumidor desde el link que está en el pie de todas las páginas.
              </li>
            </ul>
          </Section>

          <Section title="12. Privacidad y datos personales">
            <p>
              El tratamiento de datos personales se rige por la <strong>Ley 25.326</strong> y la{" "}
              <Link href="/privacidad" className={linkClass}>Política de privacidad</Link>.
            </p>
          </Section>

          <Section title="13. Propiedad intelectual">
            <p>
              Todo el contenido de la plataforma (diseño, código, textos, logos) es de Talency o de quienes le dieron licencia.
              No se puede reproducir, distribuir ni modificar sin autorización expresa y por escrito. Lo que cargás (CV,
              descripción de la empresa, avisos) sigue siendo tuyo; nos autorizás a mostrarlo y procesarlo sólo para prestar
              el servicio.
            </p>
          </Section>

          <Section title="14. Limitación de responsabilidad">
            <p>
              BBJobs actúa como intermediario entre empresas y postulantes. Talency verifica a las empresas para reducir
              riesgos, pero no puede garantizar que toda la información que cargan los usuarios sea verdadera ni que un
              postulante sea idóneo. Talency no es responsable por la relación laboral entre las partes, ni por las decisiones
              que tome una empresa sobre un postulante (incluidas las que tome mirando una recomendación), ni por el contenido
              de los avisos o las observaciones que escriben las empresas. Nada de esto limita los derechos que te da la ley si
              sos consumidor.
            </p>
          </Section>

          <Section title="15. Cambios en estos términos">
            <p>
              Podemos cambiar estos términos. Si el cambio es importante, te avisamos por la plataforma y por mail con al menos
              15 días de anticipación, y la próxima vez que entres después de esa fecha te vamos a pedir que aceptes la versión
              nueva. Si no estás de acuerdo, podés borrar tu cuenta en cualquier momento.
            </p>
          </Section>

          <Section title="16. Ley aplicable y jurisdicción">
            <p>
              Estos términos se rigen por las leyes de la República Argentina. Para cualquier conflicto son competentes los
              tribunales ordinarios de Bahía Blanca, provincia de Buenos Aires. Si sos consumidor, también podés reclamar ante
              los tribunales de tu domicilio y ante la autoridad de Defensa del Consumidor, como prevé la Ley 24.240.
            </p>
          </Section>

          <Section title="17. Contacto">
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
