export default function TerminosPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Términos y condiciones de uso</h1>
          <p className="text-sm text-[#64748B]">Última actualización: junio de 2025</p>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 space-y-8 text-[#1C2230]">

          <Section title="1. Aceptación de los términos">
            <p>
              Al acceder o utilizar BBJobs (en adelante, &quot;la plataforma&quot;), el usuario acepta quedar vinculado
              por los presentes Términos y Condiciones. Si no está de acuerdo con alguno de estos términos,
              debe abstenerse de utilizar la plataforma.
            </p>
            <p className="mt-3">
              BBJobs es administrada por <strong>Talency</strong>, consultora de recursos humanos con sede en
              Bahía Blanca, provincia de Buenos Aires, República Argentina.
            </p>
          </Section>

          <Section title="2. Descripción del servicio">
            <p>
              BBJobs es una plataforma digital que facilita la conexión entre empresas y candidatos laborales
              en Bahía Blanca y la región. La plataforma permite a las empresas publicar búsquedas de empleo
              y a los candidatos postularse a las mismas, gestionando el proceso de selección de forma centralizada.
            </p>
          </Section>

          <Section title="3. Registro y cuentas">
            <ul className="list-disc pl-5 space-y-2">
              <li>Para utilizar las funciones principales, es necesario registrarse con información veraz y actualizada.</li>
              <li>Cada usuario es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
              <li>
                Las cuentas de empresa requieren verificación manual por parte del equipo de Talency antes
                de poder publicar búsquedas. Talency se reserva el derecho de rechazar o suspender cuentas
                que no cumplan los requisitos o que incurran en conductas indebidas.
              </li>
              <li>Los candidatos son responsables de la veracidad de la información cargada en su perfil y CV.</li>
            </ul>
          </Section>

          <Section title="4. Uso permitido y prohibido">
            <p className="mb-3">Los usuarios se comprometen a no utilizar la plataforma para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Publicar avisos laborales falsos, engañosos o que incumplan la legislación laboral argentina.</li>
              <li>Discriminar por razones de género, edad, origen étnico, religión, orientación sexual u otras condiciones protegidas por ley.</li>
              <li>Recopilar datos de otros usuarios con fines comerciales o no autorizados.</li>
              <li>Intentar acceder de forma no autorizada a sistemas o cuentas ajenas.</li>
              <li>Publicar contenido ofensivo, fraudulento o que viole derechos de terceros.</li>
            </ul>
          </Section>

          <Section title="5. Privacidad y datos personales">
            <p>
              El tratamiento de datos personales se rige por la{" "}
              <strong>Ley 25.326 de Protección de Datos Personales</strong> de la República Argentina y la
              Política de Privacidad de BBJobs, disponible en <a href="/privacidad" className="text-[#1E8EA3] hover:underline">/privacidad</a>.
            </p>
          </Section>

          <Section title="6. Propiedad intelectual">
            <p>
              Todo el contenido de la plataforma (diseño, código, textos, logotipos) es propiedad de Talency
              o de sus licenciantes. Queda prohibida su reproducción, distribución o modificación sin
              autorización expresa y por escrito.
            </p>
          </Section>

          <Section title="7. Limitación de responsabilidad">
            <p>
              BBJobs actúa como intermediario entre empresas y candidatos. Talency no garantiza la idoneidad
              de los candidatos ni la veracidad de toda la información cargada por los usuarios, aunque
              implementa mecanismos de verificación para minimizar el riesgo. En ningún caso Talency será
              responsable por daños derivados de la relación laboral entre las partes.
            </p>
          </Section>

          <Section title="8. Modificaciones">
            <p>
              Talency se reserva el derecho de modificar estos términos en cualquier momento. Los cambios
              serán notificados a través de la plataforma y entrarán en vigencia a los 10 días corridos
              de su publicación. El uso continuado de la plataforma implica la aceptación de los nuevos términos.
            </p>
          </Section>

          <Section title="9. Ley aplicable y jurisdicción">
            <p>
              Estos términos se rigen por las leyes de la República Argentina. Para cualquier controversia,
              las partes se someten a la jurisdicción de los tribunales ordinarios de la ciudad de
              Bahía Blanca, provincia de Buenos Aires, con renuncia expresa a cualquier otro fuero.
            </p>
          </Section>

          <Section title="10. Contacto">
            <p>
              Para consultas relacionadas con estos términos, podés escribirnos a{" "}
              <a href="mailto:info@bbjobs.com.ar" className="text-[#1E8EA3] hover:underline">info@bbjobs.com.ar</a>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-lg text-[#1C2230] mb-3 pb-2 border-b border-[#DDE3EC]">{title}</h2>
      <div className="text-sm text-[#64748B] leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
