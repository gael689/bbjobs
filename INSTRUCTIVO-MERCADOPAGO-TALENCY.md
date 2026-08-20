# Mercado Pago — estado y pasos para cobrar de verdad

> Actualizado 19/08/2026, con el estado real verificado contra producción.

---

## Dónde estamos parados

| Pieza | Estado |
|---|---|
| Código del circuito completo | ✅ construido y deployado |
| Credenciales en Railway | ⚠️ de un **usuario de prueba** (`TESTUSER4912995372853432878`) |
| Verificación de firma | ✅ activa — un POST sin firma devuelve `401` |
| URL del webhook | ✅ existe y responde (`405` en GET, `404` sin el guion) |
| **Avisos de MP recibidos** | ❌ **cero, en toda la historia** |
| Intentos de compra | 2 (19/08 16:30 y 16:55), los dos con `mp_status = NULL` |

**Con estas credenciales no le llega plata a nadie.** Son pagos simulados.

---

## ⚠️ Lo que hay que despejar antes de pasar a producción

`mp_webhook_events` está **vacía**: Mercado Pago nunca llamó al servidor. Hay dos explicaciones
y son muy distintas:

1. **Los pagos no se completaron.** Se abrió el checkout y se abandonó. En ese caso no hay
   nada roto: MP no avisa de un pago que no ocurrió.
2. **El webhook no está registrado, o lo está con la URL o el evento equivocados.** En ese
   caso el circuito está roto y **no se nota**: con plata real la empresa paga, MP cobra, y el
   pack nunca se activa.

**Pasar a producción sin despejar esto es el peor escenario del proyecto**, porque el síntoma
aparece recién cuando hay dinero de un cliente de por medio.

### Cómo despejarlo en diez segundos, sin pagar

Panel de MP → aplicación de BBJobs → **Webhooks** → **Simular notificación**.
Evento **Pagos**, y enviar.

| Respuesta | Qué significa | Qué hacer |
|---|---|---|
| `404` | La URL está mal | Corregirla (ver abajo) |
| **`401`** | ✅ **Llegó bien.** El endpoint existe y rechaza la firma simulada, que es lo correcto | Nada, seguir |
| `500` | Llegó y explotó | Avisar, hay que mirar los logs |

El `401` es la respuesta **buena**: prueba que MP alcanza el servidor y que la firma se está
verificando.

### La URL, exacta

```
https://api.bbjobs.com.ar/api/v1/webhooks/mercado-pago
```

Dos formas de equivocarse, las dos silenciosas: sin el `api.` al principio (el apex es el
frontend en Vercel) y sin el guion en `mercado-pago`. Las dos dan `404`.

**Evento: sólo "Pagos".** ⚠️ La aplicación figura como *API Orders*, así que "Order" es la
opción que parece natural — y es la equivocada. El handler descarta todo lo que no empiece con
`payment` (`webhooks.py:126-136`), devolviendo `200 ignored`. Falla igual de sorda que una URL
mal escrita.

---

## Cuando lleguen las credenciales productivas

Talency tiene que pasar **tres** valores, todos de la cuenta real (User ID `2691117435`):

1. **Access Token** de producción — empieza con `APP_USR-`
2. **Public Key** de producción
3. **Clave secreta del webhook**, la del casillero **de producción**

### ⚠️ El error que rompe todo en silencio

El panel guarda **configuraciones separadas para prueba y para producción, cada una con su
propia clave secreta**. Y del lado del código la firma es obligatoria apenas hay un secret
cargado (`mercado_pago.py:46-52`).

> Access token de **producción** + secret de **prueba** = **todos** los avisos rebotan con
> `401` y ningún pago se acredita jamás. MP reintenta, se rinde, y del lado nuestro sólo
> quedan unos 401 en un log que nadie mira.

**Los tres valores tienen que ser del mismo modo.** Y el access token de producción **no**
puede empezar con `TEST-`.

### El comando

```
railway variables --service bbjobs \
  --set "MP_ACCESS_TOKEN=..." \
  --set "MP_PUBLIC_KEY=..." \
  --set "MP_WEBHOOK_SECRET=..." > /dev/null && echo OK
```

El `> /dev/null` es a propósito: `railway variables --set` imprime la tabla completa de
variables del servicio, o sea todos los secretos de producción. Dispara un redeploy.

### La verificación, después

1. `/health` responde `200`.
2. Un POST sin firma al webhook devuelve `401` — prueba que el secret nuevo quedó cargado.
3. **Un pago real de monto bajo.** Es el único paso que no se puede simular: confirma que la
   plata efectivamente entra a la cuenta de Talency.
4. Que el pack quede `active` y el saldo muestre los 15 contactos.

Para el paso 3, si se quiere probar con $1 en vez de $49.900, hay que tocar
`TALENT_PACK_PRICE` en `backend/app/schemas/payment.py` **y su espejo en el frontend**
(`/planes` y `/planes/base-de-talento`), deployar, probar, y revertir. **Son dos lugares**: si
se cambia uno solo, la empresa ve un número y se le cobra otro.

---

## Lo único que falta definir con Eugenia

**El precio del destacado.** Hoy `$5.000`, fijo en el código. Si lo quiere poder cambiar sola
desde el panel, es sacarlo a la tabla de configuración del sitio (la de los interruptores, que
ya existe) más una pantalla para editarlo. Trabajo chico, pero aparte.

---

## Cómo revocar el token si se filtra

Es la **única** credencial del proyecto que mueve dinero real. Desde el panel de MP, en la
aplicación → Credenciales de producción → regenerar. Después recargar la variable en Railway
con el comando de arriba. Anotado acá porque el `DEPLOY-PLAN.md:524` lo pedía como pendiente y
no estaba escrito en ningún lado.
