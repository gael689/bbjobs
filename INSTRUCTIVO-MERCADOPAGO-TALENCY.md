# Mercado Pago — configurar el webhook y pasar a producción

> Estado al 18/08/2026: **las credenciales ya las tiene Gael** (prueba, producción y clave
> secreta). Lo único que falta es registrar el webhook y hacer la prueba real de punta a punta.
>
> Esto lo hace Gael, no Talency. Eugenia sólo tiene que decidir el precio.

---

## La URL, que es lo que falta

```
https://api.bbjobs.com.ar/api/v1/webhooks/mercado-pago
```

Copiar y pegar, no escribir a mano. Dos formas de equivocarse, las dos silenciosas:

| Error | Qué pasa |
|---|---|
| `bbjobs.com.ar` en vez de `api.bbjobs.com.ar` | El apex es el **frontend** en Vercel. No tiene la API: 404. |
| `mercadopago` en vez de `mercado-pago` | La ruta real lleva guion (`backend/app/api/v1/webhooks.py:152`): 404. |

> El plan del 14/08 tenía **las dos** equivocadas. Corregido allá con nota; `DEPLOY-PLAN.md:515`
> siempre la tuvo bien.

En los dos casos la falla es sorda: la empresa paga, la plata entra, MP reintenta un rato contra
un 404 y se rinde, y el aviso **nunca se destaca**. Nadie se entera hasta que la empresa reclama.

---

## Dónde se registra

Panel de MP → **Tus integraciones** → la aplicación de BBJobs → **Webhooks**
(o "Notificaciones" → "Webhooks", según cómo lo muestre).

1. Pegar la URL en **"URL de producción"**.
2. En **eventos**, tildar únicamente **Pagos** (`payment`). Ninguno más.
3. Guardar → MP muestra la **clave secreta** de *esa* configuración.

**El webhook se registra en el panel, no en el código.** `create_preference`
(`integrations/mercado_pago.py:20-36`) **no manda `notification_url`** — arma la preferencia con
items, `external_reference`, `back_urls` y `auto_return`, nada más. Así que MP sólo sabe a dónde
avisar por lo que diga el panel. Si el panel está vacío, no llega ningún aviso por más que las
credenciales estén perfectas.

---

## ⚠️ El detalle que puede arruinar todo: hay dos secrets, uno por modo

El panel de MP mantiene **configuraciones separadas para prueba y para producción, y cada una
tiene su propia clave secreta.** Son distintas.

Y del lado del código, la firma pasa a ser **obligatoria** apenas hay un secret cargado
(`webhook_signature_required()`, `mercado_pago.py:46-52`). Eso está bien —
antes bastaba con no mandar los headers para saltear la validación entera— pero significa esto:

> Si `MP_ACCESS_TOKEN` es el de **producción** y `MP_WEBHOOK_SECRET` es el de **prueba**
> (o al revés), **todos** los avisos rebotan con `401 Invalid signature`
> (`webhooks.py:168-172`) y ningún pago se acredita jamás.

Y falla en silencio: MP reintenta, se rinde, y del lado nuestro sólo quedan unos 401 en el log
que nadie está mirando. No hay ninguna pantalla que grite.

**Regla: los tres valores van siempre del mismo modo.** Si se carga el access token de
producción, el secret tiene que ser el que muestra la configuración **de producción** del panel.

Antes de dar por buena la carga, verificar que `MP_ACCESS_TOKEN` **no** empiece con `TEST-`:
las credenciales de prueba empiezan así, las de producción arrancan con `APP_USR-`.

---

## El orden para hacerlo

### 1. Sandbox primero

Cargar las credenciales **de prueba** (las tres, del mismo modo) en Railway, registrar la URL en
**"URL de prueba"** del panel, y pagar con una tarjeta de test.

Vale la pena aunque tengamos las productivas: es la única forma de ejercitar el circuito entero
—firma incluida— sin mover plata real. `verify_signature` **nunca corrió contra una firma real**;
hasta hoy fue siempre un no-op porque el secret estaba vacío (`MERCADOPAGO-DESTACAR-PLAN.md:58`).
Si el manifest de la firma (`mercado_pago.py:84`) tiene algo mal, quiero descubrirlo acá.

Qué confirmar:

- [ ] El webhook **llega** (queda la fila en `mercado_pago_webhook_events`), no un 404.
- [ ] La firma **valida** — o sea, no hay 401 en el log de Railway.
- [ ] `is_featured` se prende solo.
- [ ] Llega la notificación a la empresa y a los admins.
- [ ] El pago aparece en el panel de Pagos de Eugenia.
- [ ] Un aviso repetido de MP **no** duplica nada (el chequeo de idempotencia está en
      `webhooks.py:180-183`).

### 2. Producción después

Recién con lo de arriba en verde: reemplazar por las credenciales productivas (**las tres
juntas**), registrar la URL en "URL de producción", y hacer **un pago real** de monto bajo.

Confirmar que la plata **entra de verdad a la cuenta de Talency** — es lo único que el sandbox
no puede demostrar.

### 3. Runbook

Anotar en un lugar visible **cómo revocar el `MP_ACCESS_TOKEN`** si se filtra. Es la única
credencial del proyecto que mueve dinero real
(`DEPLOY-PLAN.md:524`, sigue pendiente).

---

## Lo único que necesita Eugenia

**El precio.** Hoy está fijo en `$5.000` y vive en el código
(`FEATURED_JOB_PRICE`, `backend/app/schemas/payment.py:10`), con un espejo en el frontend
(`dashboard/company/types.ts`) — cambiarlo hoy es tocar los dos y volver a deployar.

Dos preguntas para ella:

1. ¿$5.000 sigue siendo el número?
2. ¿Lo quiere poder cambiar sola desde el panel? Es un trabajo chico pero aparte: sacar el valor
   a la tabla de configuración del sitio (la de los interruptores, que ya existe) y una pantalla
   para editarlo.

Ojo con el espejo del frontend cuando se toque: **el precio está duplicado en dos archivos**, y
si se cambia uno solo, la empresa ve un número en pantalla y se le cobra otro.
