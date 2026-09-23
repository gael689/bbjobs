/**
 * Arma el link de WhatsApp (`wa.me`) para un teléfono argentino escrito como lo escribe la gente:
 * "2914 123456", "0291 15 4123456", "+54 9 291 4123456", "4123456".
 *
 * wa.me espera el número internacional para celulares: `549` + característica + número, sin el
 * `0` de la característica ni el `15`. Es canal asistido: el link sólo abre el chat, el mensaje lo
 * escribe y lo envía una persona.
 *
 * Si no se puede normalizar con confianza devuelve `null`, y la UI ofrece sólo "Llamar" (`tel:`).
 */

// Característica por defecto cuando alguien escribe el número local sin ella. El portal es de
// Bahía Blanca: "4123456" o "15 4123456" casi seguro son de acá.
const CARACTERISTICA_LOCAL = "291";

export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);

  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);

  // Con "15": característica (2 a 4 dígitos) + 15 + número = 12 dígitos. Se prueba primero la de
  // 3 dígitos (291, la de Bahía), después 4 (2932 Punta Alta y la zona) y 2 (11, CABA).
  if (d.length === 12) {
    for (const largo of [3, 4, 2]) {
      if (d.slice(largo, largo + 2) === "15") {
        d = d.slice(0, largo) + d.slice(largo + 2);
        break;
      }
    }
  }

  // Número local sin característica, con o sin 15.
  if (d.length === 9 && d.startsWith("15")) d = CARACTERISTICA_LOCAL + d.slice(2);
  else if (d.length === 7) d = CARACTERISTICA_LOCAL + d;

  return d.length === 10 ? `https://wa.me/549${d}` : null;
}

/** `tel:` sin espacios ni guiones, conservando un "+" inicial. */
export function telLink(phone: string): string {
  const t = phone.trim();
  return `tel:${t.startsWith("+") ? "+" : ""}${t.replace(/\D/g, "")}`;
}
