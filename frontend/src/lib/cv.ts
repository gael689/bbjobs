import { api } from "./api";

/**
 * Abre el CV de un candidato.
 *
 * El CV vive en Cloudinary como archivo privado y su URL no se puede abrir directo: la cuenta
 * tiene restringida la entrega de PDF y devuelve 401 (era el "Esta página no funciona / HTTP
 * ERROR 401" que reportaban tanto el admin como el candidato). El backend valida permisos y
 * devuelve un link firmado que vence a los 5 minutos.
 *
 * `endpoint` cambia según quién mira:
 *   - candidato   → /me/candidate/cv/link
 *   - empresa     → /me/company/candidates/{id}/cv/link
 *   - admin       → /admin/candidates/{id}/cv/link
 */
export async function abrirCv(endpoint: string, opts?: { descargar?: boolean }) {
  const descargar = !!opts?.descargar;

  // La pestaña se abre ANTES del await: si se abriera después, el navegador ya no la asocia
  // al click del usuario y el bloqueador de popups la mata.
  const pestana = descargar ? null : window.open("", "_blank", "noopener");

  try {
    const r = await api.get(endpoint, { params: { attachment: descargar } });
    const url: string = r.data.url;

    if (descargar) {
      window.location.href = url;
    } else if (pestana) {
      pestana.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (e) {
    pestana?.close();
    throw e;
  }
}
