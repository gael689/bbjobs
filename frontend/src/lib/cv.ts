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
      // Una descarga no reemplaza lo que estás mirando: el navegador baja el
      // archivo y la página queda donde estaba.
      window.location.href = url;
      return;
    }

    if (pestana) {
      pestana.location.href = url;
      return;
    }

    // El bloqueador de popups mató la pestaña. Acá antes iba
    // `window.location.href = url`, que se llevaba puesta la pantalla en la que
    // estabas —el listado de postulantes, la búsqueda a medio revisar— y para
    // volver había que apretar atrás. Ver un CV nunca debería costar el lugar
    // donde estabas.
    //
    // Un <a target="_blank"> disparado con click sí conserva la relación con el
    // gesto del usuario, así que pasa donde `window.open` diferido no pasa.
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    pestana?.close();
    throw e;
  }
}
