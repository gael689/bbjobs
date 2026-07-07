export default function PrivacidadPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[108px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Legal</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] mb-3">Política de privacidad</h1>
          <p className="text-sm text-[#64748B]">Última actualización: junio de 2025</p>
        </div>

        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl px-6 py-4 mb-6 text-sm text-[#1C2230]">
          <strong>Tu privacidad es nuestra prioridad.</strong> En BBJobs tu perfil es privado por defecto:
          solo las empresas verificadas a las que decidiste postularte pueden ver tu información.
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 space-y-8 text-[#1C2230]">

          <Section title="1. Responsable del tratamiento">
            <p>
              El responsable del tratamiento de datos personales recolectados a través de BBJobs es{" "}
              <strong>Talency</strong>, consultora de recursos humanos con domicilio en Bahía Blanca,
              provincia de Buenos Aires, República Argentina.
            </p>
            <p className="mt-3">
              Para ejercer tus derechos o realizar consultas sobre privacidad, podés escribir a{" "}
              <a href="mailto:privacidad@bbjobs.com.ar" className="text-[#1E8EA3] hover:underline">
                privacidad@bbjobs.com.ar
              </a>.
            </p>
          </Section>

          <Section title="2. Base legal">
            <p>
              El tratamiento de datos se realiza en el marco de la{" "}
              <strong>Ley 25.326 de Protección de Datos Personales</strong> de la República Argentina y sus
              normas reglamentarias. La base legal para el tratamiento es el consentimiento expreso del titular,
              la ejecución de la relación contractual y el cumplimiento de obligaciones legales.
            </p>
          </Section>

          <Section title="3. Datos que recolectamos">
            <p className="mb-3 font-medium text-[#1C2230]">Para candidatos:</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>Datos de identificación: nombre, apellido, teléfono y correo electrónico.</li>
              <li>Información laboral: experiencia, formación académica, habilidades e idiomas.</li>
              <li>CV en formato PDF (almacenado en servidores seguros de terceros).</li>
              <li>Carta de presentación incluida en cada postulación (opcional).</li>
            </ul>
            <p className="mb-3 font-medium text-[#1C2230]">Para empresas:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Datos corporativos: razón social, CUIT, industria, provincia y localidad.</li>
              <li>Datos del responsable: nombre, apellido, cargo, teléfono y correo electrónico.</li>
              <li>Documentación de verificación presentada voluntariamente.</li>
              <li>Logo de la empresa (almacenado en servidores seguros de terceros).</li>
            </ul>
          </Section>

          <Section title="4. Finalidad del tratamiento">
            <ul className="list-disc pl-5 space-y-2">
              <li>Brindar el servicio de intermediación laboral entre empresas y candidatos.</li>
              <li>Verificar la identidad de las empresas registradas en la plataforma.</li>
              <li>Gestionar el proceso de postulación y seguimiento de candidaturas.</li>
              <li>Enviar notificaciones relacionadas con el uso de la plataforma.</li>
              <li>Cumplir con obligaciones legales y regulatorias aplicables.</li>
            </ul>
          </Section>

          <Section title="5. Quién puede ver tus datos">
            <p className="mb-3">
              <strong>Si sos candidato:</strong> tu perfil (datos personales, CV, experiencia, formación)
              solo es visible para las empresas verificadas a las que hayas enviado una postulación.
              Ninguna otra empresa ni usuario de la plataforma accede a tu información. Talency accede
              a los datos únicamente para tareas de administración y soporte.
            </p>
            <p>
              <strong>Si sos empresa:</strong> tu información corporativa y la de tu responsable es accesible
              para el equipo de Talency a efectos de verificación. Los candidatos que se postulen a tus
              búsquedas podrán ver el nombre de tu empresa y los datos de la vacante, pero no tus datos
              de contacto internos.
            </p>
          </Section>

          <Section title="6. Transferencia de datos a terceros">
            <p>
              BBJobs utiliza servicios de terceros para el funcionamiento de la plataforma, incluyendo:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong>Cloudinary</strong> — almacenamiento de CVs y logotipos.</li>
              <li><strong>Railway</strong> — infraestructura de base de datos en la nube.</li>
              <li><strong>Vercel</strong> — hosting del frontend.</li>
            </ul>
            <p className="mt-3">
              Estos proveedores son seleccionados por ofrecer garantías adecuadas de seguridad.
              No vendemos ni cedemos datos personales a terceros con fines comerciales.
            </p>
          </Section>

          <Section title="7. Conservación de datos">
            <p>
              Los datos se conservan mientras la cuenta esté activa. Al eliminar tu cuenta, los datos
              personales son borrados de forma definitiva conforme al procedimiento de baja establecido
              en la plataforma, respetando los plazos mínimos de conservación que exige la legislación argentina.
            </p>
          </Section>

          <Section title="8. Tus derechos">
            <p className="mb-3">
              En virtud de la Ley 25.326, tenés derecho a:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Acceso:</strong> solicitar qué datos tuyos almacenamos.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de tus datos ("derecho al olvido").</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos para determinadas finalidades.</li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos, escribí a{" "}
              <a href="mailto:privacidad@bbjobs.com.ar" className="text-[#1E8EA3] hover:underline">
                privacidad@bbjobs.com.ar
              </a>{" "}
              indicando tu solicitud. Responderemos en un plazo máximo de 30 días hábiles.
            </p>
          </Section>

          <Section title="9. Seguridad">
            <p>
              Implementamos medidas técnicas y organizativas para proteger tus datos frente a accesos
              no autorizados, pérdida o destrucción. Entre ellas: autenticación con tokens JWT de corta
              duración, cookies httpOnly para las sesiones, cifrado en tránsito mediante HTTPS y
              almacenamiento de archivos en servidores con control de acceso.
            </p>
          </Section>

          <Section title="10. Cambios en esta política">
            <p>
              Podemos actualizar esta política periódicamente. Cualquier cambio relevante será comunicado
              a los usuarios registrados. La versión vigente siempre estará disponible en{" "}
              <a href="/privacidad" className="text-[#1E8EA3] hover:underline">bbjobs.com.ar/privacidad</a>.
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
