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
  //
  // ⚠️ Sin `noopener`, y es a propósito: con esa feature `window.open()` **devuelve null**
  // por especificación (justamente para que quien abre no pueda tocar la ventana nueva). O
  // sea que `pestana` quedaba siempre en null, la pestaña en blanco se abría igual pero
  // ingobernable, y el código caía al fallback del <a> — que después del await ya no cuenta
  // como gesto del usuario y el bloqueador lo mata. Resultado: pestaña en blanco y ningún
  // CV, que es exactamente lo que reportó Eugenia. Descargar andaba porque no pasa por acá.
  // La relación con el opener se corta a mano abajo, antes de navegar.
  const pestana = descargar ? null : window.open("", "_blank");

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
      // Se corta el vínculo con el opener **antes** de navegar, mientras la pestaña sigue
      // siendo `about:blank` y del mismo origen: una vez que apunta a Cloudinary es otro
      // origen y tocarle propiedades se vuelve terreno resbaladizo. Esto es lo que daba
      // `noopener` sin el efecto de que `window.open` devuelva null.
      pestana.opener = null;
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
