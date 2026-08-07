/** Lado máximo de la foto de perfil ya achicada. Alcanza de sobra para el avatar más grande
 *  que muestra el panel (64px) incluso en pantallas retina. */
const LADO_MAXIMO = 800;

/** Calidad del JPEG resultante. 0.82 es el punto donde dejar de bajar no se nota y seguir
 *  bajando sí. */
const CALIDAD = 0.82;

/**
 * Achica una foto en el navegador antes de subirla.
 *
 * Una foto de celular pesa 4-6 MB y el backend rechaza más de 2 MB, así que sin esto la carga
 * fallaba o tardaba una eternidad por 4G — era la mitad del "se tilda bastante" que reportó
 * Eugenia (la otra mitad, que la subida bloqueara el backend entero, se arregló aparte).
 *
 * Si algo falla, devuelve el archivo original: es preferible intentar subirlo y que el backend
 * decida, antes que bloquear al usuario por un problema de canvas.
 */
export async function achicarImagen(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));

    // Ya es chica: no vale la pena recomprimirla y perder calidad sin ganar nada.
    if (escala === 1 && file.size <= 1_000_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/jpeg", CALIDAD)
    );
    if (!blob) return file;

    // Si comprimir no achicó nada (pasa con imágenes ya optimizadas), se queda la original.
    if (blob.size >= file.size) return file;

    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
