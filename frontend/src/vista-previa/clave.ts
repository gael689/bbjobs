import { timingSafeEqual } from "node:crypto";

// La clave vive en la variable VISTA_PREVIA_CLAVE del hosting. Sin variable o con otra clave, las
// páginas de vista previa responden 404, como si no existieran. Se usa sólo en el servidor.
export function claveValida(recibida: string): boolean {
  const esperada = process.env.VISTA_PREVIA_CLAVE;
  if (!esperada || esperada.length < 16) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
