import Link from "next/link";
import Section, { linkClass } from "@/components/legal/Section";
import { LEGAL_VERSION, LEGAL_VIGENTE_DESDE } from "@/lib/legal";

// Versión 2.0 (06/10/2026): describe lo que la plataforma ya hace en producción (Base de Talento,
// pagos, Clerk) y corrige los plazos de la Ley 25.326. Lo de los módulos nuevos (IA, mails,
// Revisión de CV) se suma cuando se lancen; el borrador completo está fuera del repo.
export default function PrivacidadPage() {
  const mail = <a href="mailto:privacidad@bbjobs.com.ar" className={linkClass}>privacidad@bbjobs.com.ar</a>;
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Política de privacidad</h1>
          <p className="text-sm text-[#64748B]">Versión {LEGAL_VERSION} · Vigente desde el {LEGAL_VIGENTE_DESDE}</p>
        </div>

        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl px-6 py-4 mb-6 text-sm text-[#1C2230]">
          <strong>Tu perfil es privado por defecto.</strong> Lo ven las empresas verificadas a las que te postulás y,{" "}
          <strong>sólo si vos lo autorizás</strong>, las empresas verificadas que buscan en la Base de Talento. Podés cambiar
          esa decisión cuando quieras.
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
              <li><strong>nos diste tu consentimiento</strong> al registrarte y, para la Base de Talento, por separado;</li>
              <li>son <strong>necesarios para prestarte el servicio</strong> que pediste (publicar búsquedas, postularte, cobrar un pago);</li>
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
              <li>Los mensajes que nos mandes por el formulario de contacto o el botón de arrepentimiento.</li>
            </ul>
          </Section>

          <Section title="4. Para qué los usamos">
            <ul className="list-disc pl-5 space-y-1">
              <li>Conectar empresas y postulantes: mostrar tu perfil a quien corresponde y gestionar las postulaciones.</li>
              <li>Verificar que las empresas existen y son quienes dicen ser.</li>
              <li>Hacer funcionar la Base de Talento, si la autorizaste.</li>
              <li>Cobrar los servicios pagos y llevar el registro contable.</li>
              <li>Avisarte lo que pasa con tu cuenta y tus postulaciones.</li>
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

          <Section title="7. Proveedores que procesan datos y transferencia internacional">
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
              <li><strong>Vercel</strong> (EE.UU. y red global): publica el sitio web; recibe datos técnicos de navegación.</li>
              <li><strong>Mercado Pago</strong> (Argentina): cobra los destacados y los packs. Tus datos de pago los cargás directamente en Mercado Pago; nosotros sólo recibimos el estado del pago.</li>
            </ul>
          </Section>

          <Section title="8. Cuánto tiempo guardamos tus datos">
            <ul className="list-disc pl-5 space-y-1">
              <li>Mientras tengas la cuenta activa.</li>
              <li>
                Si borrás tu cuenta (desde Mi cuenta, en cualquier momento), borramos tus datos personales, tu CV y tu foto.
                Si tu cuenta tiene postulaciones, pagos o desbloqueos, dejamos un registro <strong>sin datos personales</strong>{" "}
                para que no se rompa la historia de otros usuarios ni la contabilidad.
              </li>
              <li>Los registros de pagos se guardan el tiempo que exigen las normas contables e impositivas.</li>
            </ul>
          </Section>

          <Section title="9. Tus derechos y cómo ejercerlos">
            <p>Tenés derecho a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Acceso:</strong> saber qué datos tuyos tenemos. Te respondemos dentro de los <strong>10 días corridos</strong>.</li>
              <li><strong>Rectificación y actualización:</strong> corregir lo que esté mal. Casi todo lo podés hacer vos desde tu perfil; si no, te respondemos dentro de los <strong>5 días hábiles</strong>.</li>
              <li><strong>Supresión:</strong> que borremos tus datos. Podés borrar tu cuenta vos desde Mi cuenta, o pedírnoslo; te respondemos dentro de los <strong>5 días hábiles</strong>.</li>
              <li><strong>Retirar un consentimiento</strong>, como el de la Base de Talento, cuando quieras, sin que te afecte en el resto del servicio.</li>
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

          <Section title="10. Seguridad">
            <p>
              Todo el sitio usa conexiones cifradas (HTTPS). El inicio de sesión lo gestiona Clerk, un proveedor
              especializado: nosotros nunca guardamos tu contraseña. Los CVs se guardan como archivos{" "}
              <strong>privados</strong>: sólo se abren con un link temporal que generamos para quien tiene permiso de verlos
              y que vence a los pocos minutos. Cada empresa sólo accede a los datos de sus propias búsquedas. Ningún sistema
              es infalible: si detectamos un incidente que afecte tus datos, te vamos a avisar.
            </p>
          </Section>

          <Section title="11. Cookies">
            <p>
              Usamos sólo las cookies necesarias para que puedas iniciar sesión y mantenerla abierta (son de Clerk). No usamos
              cookies de publicidad ni de seguimiento de terceros.
            </p>
          </Section>

          <Section title="12. Menores de edad">
            <p>BBJobs es para personas de 18 años o más. Si nos enteramos de que un menor cargó sus datos, los borramos.</p>
          </Section>

          <Section title="13. Cambios en esta política">
            <p>
              Podemos actualizar esta política. Si el cambio es importante, te avisamos por la plataforma al menos 15 días
              antes de que entre en vigencia y te pedimos que aceptes la versión nueva la próxima vez que entres. La versión
              vigente está siempre en <Link href="/privacidad" className={linkClass}>bbjobs.com.ar/privacidad</Link>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
