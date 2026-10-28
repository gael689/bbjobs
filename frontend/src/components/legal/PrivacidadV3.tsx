import Link from "next/link";
import Section, { linkClass } from "@/components/legal/Section";
import { LEGAL_ENCABEZADO } from "@/lib/legal";

// Versión 3.0 (28/10/2026): la 2.0 más los módulos nuevos (IA, mails, Revisión de CV, observaciones
// de las empresas, "Vieron tu CV", aviso de otro proceso y prospección). Sólo con la compuerta de
// módulos nuevos abierta. Lo que se apoya en el consentimiento de esta versión (IA y aviso de otro
// proceso) el backend lo aplica sólo a quien la aceptó (backend/app/core/legal.py).
// Revisada contra la Ley 25.326, el Decreto 1558/2001, la Disp. DNPDP 10/2008 y la Ley 24.240:
// ver LEGAL-PLAN.md §11.
export default function PrivacidadV3() {
  const mail = <a href="mailto:privacidad@bbjobs.com.ar" className={linkClass}>privacidad@bbjobs.com.ar</a>;
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Política de privacidad</h1>
          <p className="text-sm text-[#64748B]">{LEGAL_ENCABEZADO}</p>
        </div>

        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl px-6 py-4 mb-6 text-sm text-[#1C2230] space-y-2">
          <p>
            <strong>Tu perfil es privado por defecto.</strong> Lo ven las empresas verificadas a las que te postulás y,{" "}
            <strong>sólo si vos lo autorizás</strong>, las empresas verificadas que buscan en la Base de Talento.
          </p>
          <p>
            <strong>Lo nuevo de esta versión:</strong> recomendaciones con inteligencia artificial (siempre decide una
            persona y podés oponerte), avisos por mail, la Revisión de CV, las observaciones internas de las empresas y el
            aviso de que estás en otro proceso. Todo lo que podés apagar está en Mi cuenta.
          </p>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 space-y-8 text-[#1C2230]">

          <Section title="1. Quién es responsable de tus datos">
            <p>
              El responsable de la base de datos de BBJobs es <strong>Talency</strong>, consultora de recursos humanos de
              Bahía Blanca, provincia de Buenos Aires, República Argentina.
            </p>
            <p>
              El desarrollo y el mantenimiento técnico de la plataforma los hace un proveedor que trabaja por cuenta y orden
              de Talency, con acceso a los datos sólo para eso y con obligación de confidencialidad.
            </p>
            <p>Para cualquier consulta sobre tus datos: {mail}.</p>
          </Section>

          <Section title="2. Base legal">
            <p>
              Tratamos tus datos según la <strong>Ley 25.326 de Protección de los Datos Personales</strong>, su decreto
              reglamentario (1558/2001) y las normas de la Agencia de Acceso a la Información Pública (AAIP). Los tratamos
              porque:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>nos diste tu consentimiento</strong> al aceptar esta política. La Base de Talento y los mails de
                novedades tienen su propio consentimiento, aparte. El uso de tu perfil en las recomendaciones con
                inteligencia artificial y el aviso de que estás en otro proceso se apoyan en el consentimiento que das al
                aceptar esta versión, y te podés oponer cuando quieras desde Mi cuenta;
              </li>
              <li>son <strong>necesarios para prestarte el servicio</strong> que pediste (publicar búsquedas, postularte, cobrar un pago, avisarte de tus postulaciones);</li>
              <li>o porque <strong>una ley nos obliga</strong> a guardarlos (por ejemplo, los registros contables de los pagos).</li>
            </ul>
            <p>
              Darnos tus datos es voluntario, pero sin los obligatorios del registro (nombre, mail, teléfono y, para
              empresas, CUIT y razón social) no podemos darte una cuenta.
            </p>
          </Section>

          <Section title="3. Qué datos tenemos">
            <p className="font-medium text-[#1C2230]">Si sos postulante:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identificación y contacto: nombre, apellido, mail y teléfono.</li>
              <li>Perfil laboral: experiencia, formación, habilidades, idiomas, zona, disponibilidad, modalidad de trabajo y pretensión salarial, si la cargaste.</li>
              <li>Datos opcionales: foto, fecha de nacimiento y género. No cargarlos no te perjudica.</li>
              <li>Tu CV en PDF y la carta de presentación de cada postulación, si la escribiste.</li>
              <li>Tu decisión sobre la Base de Talento (sí o no, y cuándo la tomaste) y qué empresas accedieron a tus datos desde ahí.</li>
              <li>El estado de cada postulación y su historial.</li>
              <li>
                Para las recomendaciones: una versión del texto de tu CV <strong>sin tus datos personales</strong> (punto 7),
                los puntajes de afinidad con cada búsqueda y los motivos que los explican.
              </li>
              <li>Las observaciones internas que registren las empresas sobre sus procesos de selección (punto 5).</li>
              <li>Si compraste la Revisión de CV: lo que nos contaste para la revisión, el canal por el que querés que te contactemos y el estado del servicio.</li>
              <li>Las alertas de empleo que crees.</li>
            </ul>
            <p className="font-medium text-[#1C2230] pt-2">Si sos empresa:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Datos de la empresa: razón social, CUIT, rubro, provincia, localidad, cantidad de empleados, web, descripción y logo.</li>
              <li>Datos de la persona responsable: nombre, apellido, cargo, teléfono y mail.</li>
              <li>La documentación de verificación que nos mandes.</li>
              <li>Lo que compres (avisos destacados, packs de la Base de Talento) y el estado de cada pago.</li>
            </ul>
            <p className="font-medium text-[#1C2230] pt-2">De todos:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Datos técnicos que se generan al usar el sitio: fecha de ingreso, acciones dentro de la plataforma, dirección IP y tipo de navegador, para seguridad y para resolver problemas.</li>
              <li>Qué versión de estos términos y de esta política aceptaste, y cuándo.</li>
              <li>Los mails que te mandamos: a qué dirección, cuándo y si se entregaron o rebotaron. Sólo en los de <strong>novedades</strong> registramos además si los abriste o tocaste un link. Tus preferencias de qué mails querés recibir.</li>
              <li>Los mensajes que nos mandes por el formulario de contacto o el botón de arrepentimiento.</li>
            </ul>
          </Section>

          <Section title="4. Para qué los usamos">
            <ul className="list-disc pl-5 space-y-1">
              <li>Conectar empresas y postulantes: mostrar tu perfil a quien corresponde y gestionar las postulaciones.</li>
              <li>Verificar que las empresas existen y son quienes dicen ser.</li>
              <li>Hacer funcionar la Base de Talento, si la autorizaste.</li>
              <li>Ayudar a las empresas a ordenar postulantes por afinidad con su búsqueda, con inteligencia artificial y siempre con la decisión de una persona (punto 7).</li>
              <li>Mandarte por mail avisos de tu cuenta, tus postulaciones o tus búsquedas, y las alertas que crees; y, <strong>sólo si lo aceptaste</strong>, novedades de BBJobs y Talency (punto 8).</li>
              <li>Prestarte la Revisión de CV, si la compraste (punto 9).</li>
              <li>Cobrar los servicios pagos y llevar el registro contable.</li>
              <li>Cumplir con la ley y responder a pedidos de autoridades competentes.</li>
            </ul>
            <p><strong>No vendemos tus datos</strong> ni se los damos a nadie para que te mande publicidad.</p>
          </Section>

          <Section title="5. Quién puede ver tus datos">
            <p><strong>Si sos postulante:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Las <strong>empresas verificadas a las que te postulás</strong> ven tu perfil, tu CV y tu carta.</li>
              <li>
                Si autorizaste la <strong>Base de Talento</strong>, las empresas verificadas que buscan ahí ven primero un
                perfil <strong>sin tu nombre ni tus datos de contacto</strong>. Si deciden contactarte, usan un contacto de su
                pack y recién ahí ven tus datos de contacto y tu CV. En tu panel podés ver qué empresas lo hicieron.
              </li>
              <li>El equipo de Talency accede a tus datos para administrar la plataforma, verificar empresas, atender reclamos y dar soporte.</li>
              <li>
                Lo que una empresa haga con tus datos después de verlos es <strong>responsabilidad de esa empresa</strong>:
                los términos la obligan a usarlos sólo para procesos de selección.
              </li>
            </ul>
            <p>
              <strong>&quot;Vieron tu CV&quot;.</strong> Cuando una empresa abre por primera vez tu perfil o tu CV desde una
              postulación, la postulación pasa a <strong>&quot;Perfil revisado&quot;</strong> y te avisamos. No avisamos
              cuando lo abre el equipo de Talency ni cuando la misma empresa lo vuelve a abrir.
            </p>
            <p>
              <strong>Observaciones internas de las empresas.</strong> Una empresa puede registrar observaciones sobre las
              personas que participan en sus procesos de selección (por ejemplo, que no se presentó a una entrevista). Son
              internas de esa empresa: no se muestran en tu panel ni a otras empresas. El equipo de Talency las puede leer,
              sin modificarlas, para dar soporte, controlar que la plataforma se use bien y responder pedidos de acceso; cada
              lectura queda registrada. La empresa es responsable de lo que escribe y los términos le prohíben incluir
              motivos discriminatorios o datos sensibles. Como cualquier dato tuyo, podés pedir acceso a ellas (punto 13).
            </p>
            <p>
              <strong>Aviso de otro proceso.</strong> Cuando una empresa mira tu postulación, BBJobs le puede indicar que
              estás en una etapa avanzada (&quot;En proceso&quot; o &quot;Seleccionado&quot;) en una búsqueda de{" "}
              <strong>otra</strong> empresa en los últimos 90 días. Sólo se muestra cuántas: nunca qué empresa, qué búsqueda
              ni cuándo. Es informativo y no impide que te contacten. Podés pedir que no se muestre desde Mi cuenta.
            </p>
            <p>
              <strong>Si sos empresa:</strong> tus datos y los de tu responsable los ve el equipo de Talency para verificarte.
              Los postulantes ven el nombre de la empresa, su perfil público y los datos de cada búsqueda, pero no los datos
              de contacto de tu responsable.
            </p>
          </Section>

          <Section title="6. Base de Talento">
            <p>
              Es <strong>opcional</strong>. Te lo preguntamos al registrarte y podés cambiar la decisión cuando quieras desde
              tu perfil. Si decís que no, ninguna empresa te encuentra si no te postulaste a su búsqueda. Si después la
              retirás, dejás de aparecer desde ese momento; las empresas que ya accedieron a tus datos antes los conservan
              bajo su responsabilidad (punto 5).
            </p>
          </Section>

          <section id="ia" className="scroll-mt-32">
            <Section title="7. Recomendaciones con inteligencia artificial">
              <p>
                <strong>Qué hace:</strong> a una empresa le ordena sus postulantes según qué tanto encajan con la búsqueda y
                le sugiere perfiles de la Base de Talento (sólo de quienes la autorizaron). Cada recomendación muestra los
                motivos y las partes del CV en las que se basa, y puede incluir un resumen breve. También usamos la
                inteligencia artificial para sugerirte habilidades del catálogo que aparecen en tu CV.
              </p>
              <p><strong>Qué no hace:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>No decide nada.</strong> No descarta, no oculta, no cambia el estado de ninguna postulación y no
                  manda mensajes. La empresa ve <strong>siempre a todos</strong> sus postulantes; el orden es una ayuda.
                  Quien decide es una persona de la empresa.
                </li>
                <li>
                  <strong>No usa</strong> tu edad, fecha de nacimiento, género, foto, nombre, estado civil, hijos,
                  nacionalidad, religión ni salud. Si una búsqueda pide alguno de esos datos como requisito, ese requisito
                  se ignora para ordenar.
                </li>
                <li>No penaliza lo que no cargaste: un dato que falta cuenta como &quot;sin datos&quot;, no como &quot;no cumple&quot;.</li>
              </ul>
              <p>
                <strong>Cómo protegemos tu CV:</strong> antes de que el texto salga de nuestros servidores, lo procesamos{" "}
                <strong>en nuestros propios servidores</strong> para tachar tu nombre, teléfono, mail, DNI, CUIL, dirección,
                fecha de nacimiento, edad, estado civil y links. El PDF nunca sale. Lo que se envía es ese texto sin datos
                personales, junto con tus habilidades, tu zona y tu disponibilidad, a <strong>Google (Gemini)</strong>, que lo
                usa sólo para prestarnos el servicio y no lo usa para entrenar sus modelos; Google puede guardar los pedidos
                por un tiempo limitado para detectar abusos de su servicio. El tachado es automático y puede fallar con algún
                dato escrito de forma poco común: por eso no te pedimos ni necesitamos que pongas datos sensibles en el CV.
              </p>
              <p>
                <strong>Sólo con tu aceptación:</strong> la inteligencia artificial procesa únicamente los perfiles de quienes
                aceptaron esta versión de la política.
              </p>
              <p><strong>Tus derechos sobre esto:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Tenés derecho a <strong>no ser evaluado sólo por un sistema automático</strong>: en BBJobs eso no pasa,
                  porque siempre decide una persona. Si creés que una recomendación te perjudicó, podés pedirnos una
                  explicación y que la revise una persona del equipo de Talency.
                </li>
                <li>
                  <strong>Podés oponerte</strong> desde Mi cuenta → &quot;No usar mi perfil en recomendaciones&quot;, o
                  escribiendo a {mail}. Desde ese momento borramos el texto procesado de tu CV, su índice, los puntajes y los
                  resúmenes, y no se vuelven a calcular. Tus postulaciones le aparecen <strong>igual</strong> a la empresa, sin
                  puntaje. No te perjudica.
                </li>
              </ul>
            </Section>
          </section>

          <Section title="8. Mails">
            <p>
              Te mandamos mails desde direcciones de <strong>bbjobs.com.ar</strong> por medio de <strong>Resend</strong>, un
              proveedor de envío de correo. Hay categorías:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Cuenta y pagos</strong> (verificación de empresa, pagos, Revisión de CV, borrado de cuenta, cambios en esta política): llegan siempre, porque son necesarios para el servicio.</li>
              <li><strong>Postulaciones:</strong> cambios de estado, &quot;Vieron tu CV&quot; y resumen de postulaciones nuevas.</li>
              <li><strong>Búsquedas</strong> (empresas): aprobación y vencimiento.</li>
              <li><strong>Alertas:</strong> las alertas de empleo que creaste y resúmenes.</li>
              <li><strong>Recordatorios:</strong> perfil incompleto, búsqueda por vencer.</li>
              <li><strong>Novedades:</strong> ofertas y novedades de BBJobs y Talency. A los postulantes, <strong>sólo si lo aceptaron</strong>.</li>
            </ul>
            <ul className="list-disc pl-5 space-y-1">
              <li>Salvo los de cuenta y pagos, te podés dar de baja de cada categoría con el link que está al pie de cada mail o desde Mi cuenta. La baja es inmediata y gratuita.</li>
              <li>A los postulantes sólo les mandamos novedades si marcaron la casilla, que viene <strong>destildada</strong>. A las empresas registradas les podemos mandar novedades del servicio, con la baja en cada mail.</li>
              <li>Ningún aviso lo escribe una inteligencia artificial: salen de textos fijos. Los mails de novedades los aprueba una persona de Talency.</li>
              <li>Si un mail rebota o lo marcás como spam, dejamos de escribirte a esa dirección.</li>
              <li>Si pasan 90 días sin que uses la plataforma, dejamos de mandarte resúmenes; las alertas que creaste siguen.</li>
            </ul>
          </Section>

          <Section title="9. Revisión de CV">
            <p>Si comprás la Revisión de CV:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Mercado Pago</strong> procesa el pago; nosotros no vemos ni guardamos los datos de tu tarjeta.</li>
              <li>
                El equipo de Talency ve tu <strong>nombre, el canal de contacto que elegiste (WhatsApp o mail) y ese dato, lo
                que nos contaste sobre para qué querés el CV y el CV que tenías cargado al pagar</strong>. Te pedimos tu
                consentimiento para que te contacten por ese canal.
              </li>
              <li>
                La revisión se hace <strong>fuera de la plataforma</strong>, por WhatsApp o mail. Lo que hace Talency queda
                sujeto a esta política; lo que hacen WhatsApp (Meta) o tu proveedor de mail, a sus propias condiciones.
              </li>
              <li><strong>La inteligencia artificial no participa</strong> de la Revisión de CV.</li>
            </ul>
          </Section>

          <Section title="10. Empresas que todavía no usan BBJobs">
            <p>
              Talency puede escribirles a empresas que no están registradas para ofrecerles BBJobs o sus servicios de
              selección. Para eso usa los datos de contacto <strong>comerciales que esas empresas publican</strong> (nombre,
              rubro, dirección, teléfono, mail y web). Cada mail dice quién escribe y por qué, y trae un link para no recibir
              más; la baja es inmediata, gratuita y para siempre. Si una empresa pide que borremos sus datos, los borramos y
              guardamos sólo la dirección dada de baja, para no volver a escribirle (Ley 25.326, art. 27).
            </p>
          </Section>

          <Section title="11. Proveedores que procesan datos y transferencia internacional">
            <p>
              Para que BBJobs funcione usamos proveedores que procesan datos <strong>por cuenta nuestra</strong>, sólo para
              prestarnos su servicio. Algunos están fuera de Argentina, principalmente en Estados Unidos, un país que la AAIP
              no considera con un nivel de protección adecuado. Por eso los datos se transfieren con tu consentimiento, que
              nos das al aceptar esta política, y con los compromisos de confidencialidad y seguridad que esos proveedores
              asumen en sus contratos.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Clerk</strong> (EE.UU.): registro, inicio de sesión y verificación del mail. Recibe tu mail, tu nombre, tu contraseña cifrada, datos de sesión, IP y navegador.</li>
              <li><strong>Cloudinary</strong> (EE.UU.): guarda los CVs, las fotos y los logos que subís.</li>
              <li><strong>Railway</strong>: servidores y base de datos donde vive la plataforma.</li>
              <li><strong>Vercel</strong> (EE.UU. y red global): publica el sitio web; recibe datos técnicos de navegación y cuenta las visitas por página sin usar cookies.</li>
              <li><strong>Google Analytics</strong> (EE.UU.): mide el uso del sitio <strong>sólo si aceptás las cookies de medición</strong>. No recibe tu nombre, tu mail ni datos de tu cuenta (punto 15).</li>
              <li><strong>Mercado Pago</strong> (Argentina): cobra los destacados, los packs y la Revisión de CV. Tus datos de pago los cargás directamente en Mercado Pago; nosotros sólo recibimos el estado del pago.</li>
              <li><strong>Resend</strong> (EE.UU.): envía los mails. Recibe tu mail, tu nombre y el contenido de cada aviso.</li>
              <li><strong>Google (Gemini)</strong> (EE.UU. y otros países): las recomendaciones con inteligencia artificial. Recibe el texto de tu CV <strong>sin datos personales</strong>, tus habilidades, tu zona, tu disponibilidad y los textos de las búsquedas (punto 7).</li>
            </ul>
          </Section>

          <Section title="12. Cuánto tiempo guardamos tus datos">
            <ul className="list-disc pl-5 space-y-1">
              <li>Mientras tengas la cuenta activa.</li>
              <li>
                Si borrás tu cuenta (desde Mi cuenta, en cualquier momento), borramos tus datos personales, tu CV, tu foto, lo
                que procesó la inteligencia artificial y el texto de las observaciones de las empresas. Si tu cuenta tiene
                postulaciones, pagos o desbloqueos, dejamos un registro <strong>sin datos personales</strong> para que no se
                rompa la historia de otros usuarios ni la contabilidad.
              </li>
              <li>El contenido de los mails se borra a los <strong>90 días</strong>; queda sólo a quién se mandó, cuándo y si se entregó.</li>
              <li>El texto procesado de tu CV se reemplaza cuando cambiás el CV, y se borra si borrás la cuenta o te oponés a las recomendaciones.</li>
              <li>Si te diste de baja de los mails, guardamos tu dirección en una lista de &quot;no enviar&quot;: es la única forma de respetar tu baja.</li>
              <li>Los registros de pagos se guardan el tiempo que exigen las normas contables e impositivas.</li>
            </ul>
          </Section>

          <Section title="13. Tus derechos y cómo ejercerlos">
            <p>Tenés derecho a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Acceso:</strong> saber qué datos tuyos tenemos, incluidas las observaciones que las empresas registraron sobre vos. Te respondemos dentro de los <strong>10 días corridos</strong>.</li>
              <li><strong>Rectificación y actualización:</strong> corregir lo que esté mal. Casi todo lo podés hacer vos desde tu perfil; si no, te respondemos dentro de los <strong>5 días hábiles</strong>.</li>
              <li><strong>Supresión:</strong> que borremos tus datos. Podés borrar tu cuenta vos desde Mi cuenta, o pedírnoslo; te respondemos dentro de los <strong>5 días hábiles</strong>.</li>
              <li><strong>Oposición:</strong> a que usemos tus datos para algo en particular: las recomendaciones con inteligencia artificial y el aviso de otro proceso (desde Mi cuenta), o las novedades (desde el pie de cada mail).</li>
              <li><strong>Retirar un consentimiento</strong>, como el de la Base de Talento o el de las novedades, cuando quieras, sin que te afecte en el resto del servicio.</li>
            </ul>
            <p>
              Escribinos a {mail} desde el mail de tu cuenta, diciendo qué querés. Si no escribís desde ese mail, te podemos
              pedir que acredites que sos vos.
            </p>
            <p className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3 text-xs">
              El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma
              gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme
              lo establecido en el artículo 14, inciso 3 de la Ley N.º 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN
              PÚBLICA, en su carácter de Órgano de Control de la Ley N.º 25.326, tiene la atribución de atender las denuncias
              y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes
              en materia de protección de datos personales.
            </p>
          </Section>

          <Section title="14. Seguridad">
            <p>
              Todo el sitio usa conexiones cifradas (HTTPS). El inicio de sesión lo gestiona Clerk, un proveedor
              especializado: nosotros nunca guardamos tu contraseña. Los CVs se guardan como archivos{" "}
              <strong>privados</strong>: sólo se abren con un link temporal que generamos para quien tiene permiso de verlos
              y que vence a los pocos minutos. Cada empresa sólo accede a los datos de sus propias búsquedas y a sus propias
              observaciones. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te vamos a avisar.
            </p>
          </Section>

          <Section title="15. Cookies">
            <p>
              <strong>Necesarias (siempre activas):</strong> las de Clerk, para que puedas iniciar sesión y mantenerla
              abierta, y <code>bbjobs_consent</code>, nuestra, que recuerda qué elegiste en el aviso de cookies durante 180
              días.
            </p>
            <p>
              <strong>Medición (sólo con tu consentimiento):</strong> si las aceptás en el aviso, usamos Google Analytics
              para saber cuántas personas visitan el sitio y qué secciones usan, y así mejorarlo. Sus cookies (
              <code>_ga</code> y <code>_ga_&lt;código&gt;</code>) duran hasta 2 años. Antes de que elijas no se carga nada;
              no le mandamos tu nombre, tu mail ni datos de tu cuenta, y tenemos apagadas las funciones de publicidad.
            </p>
            <p>
              <strong>Medición propia (con el mismo consentimiento):</strong> BBJobs también registra, en sus propios
              servidores, qué páginas se visitan, qué se busca, qué avisos se abren y cuántas postulaciones salen de ahí,
              para saber qué funciona y qué búsquedas no encuentran resultados. Es <strong>sin datos personales</strong>:
              no guarda tu nombre, tu mail, tu dirección IP ni tu cuenta; para no contar dos veces al mismo visitante usa
              la cookie <code>bbjobs_vid</code>, un número al azar que dura 13 meses. Los registros se borran a los 13
              meses.
            </p>
            <p>
              <strong>Sin cookies:</strong> Vercel, que publica el sitio, cuenta las visitas por página sin cookies y sin
              poder identificarte. Los mails de avisos no llevan seguimiento de aperturas; los de novedades sí (punto 3).
            </p>
            <p>
              Podés <strong>retirar o cambiar tu consentimiento</strong> cuando quieras desde &quot;Configurar cookies&quot;, en
              el pie de página: dejamos de medir en ese momento y borramos las cookies de Google Analytics y la de la medición
              propia. No usamos cookies de publicidad. El detalle de cada cookie está en la{" "}
              <Link href="/cookies" className={linkClass}>política de cookies</Link>.
            </p>
          </Section>

          <Section title="16. Menores de edad">
            <p>BBJobs es para personas de 18 años o más. Si nos enteramos de que un menor cargó sus datos, los borramos.</p>
          </Section>

          <Section title="17. Cambios en esta política">
            <p>
              Podemos actualizar esta política. Si el cambio es importante, te avisamos por la plataforma y por mail al menos
              15 días antes de que entre en vigencia y te pedimos que aceptes la versión nueva la próxima vez que entres. Si
              el cambio agrega un uso nuevo de tus datos, no lo aplicamos a tu perfil hasta que la aceptes. La versión vigente
              está siempre en <Link href="/privacidad" className={linkClass}>bbjobs.com.ar/privacidad</Link>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
