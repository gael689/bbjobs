# Tests psicométricos en BBJobs: referencias y plan de búsqueda

> 19/10/2026 · Primera ronda de búsqueda (web, sin contacto con proveedores todavía).
> Contexto: Eugenia mandó capturas del **PDA** (pp. 15–19 de `bbjobs mails auomaticos (1).pdf`).
> El módulo psicométrico sigue en pausa (`MODULOS-MAILS-IA-PLAN.md` Anexo A). El diseño tentativo
> "PDA por invitación" está en `MEJORAS-Y-MAILS-EMPRESAS-OCTUBRE-PLAN.md` §4.8 y la pregunta P14 en §3.
> Lo que dice "no confirmado" es eso: no lo encontré publicado. No lo supongas.

---

## 1. Resumen ejecutivo

1. El **PDA** es un producto **argentino** (PDA International nació en Buenos Aires en 2007 y sus términos se rigen por ley argentina). Es un inventario de adjetivos basado en el modelo de Marston (el mismo origen que el DISC) que da un perfil "natural" y otro "adaptado" en 4 ejes más uno de autocontrol. Su propio manual pide que lo interpreten **analistas certificados por PDA**.
2. **No encontré una API pública del PDA.** Sí tiene integraciones con ATS (Lever, Teamtailor, HiringRoom, Rankmi), así que algo existe del lado de ellos, pero hay que pedirlo. Los precios no son públicos.
3. Los **informes del PDA son propiedad de PDA International**: la licencia es del cliente (Talency), intransferible y atada al contrato. Para mostrarle el informe a una empresa cliente de BBJobs hace falta que PDA lo autorice por escrito.
4. **Copiar o "inspirarse" en el PDA no es opción**: el cuestionario está protegido, sus términos prohíben reproducirlo y un test casero no tendría validez demostrada.
5. Hay un **camino abierto y serio**: los ítems **IPIP** (Big Five) son de dominio público y tienen validaciones argentinas hechas en CONICET-UNC (Cupani y equipo). Sirve si una psicóloga matriculada de Talency firma y supervisa.
6. En la **provincia de Buenos Aires** (Ley 10.306) el diagnóstico de la personalidad y la emisión de informes psicológicos son ejercicio de la psicología: los hace un psicólogo matriculado, con firma propia. En Bahía Blanca corresponde el **Colegio de Psicólogos Distrito I**.
7. Recomendación: **(A) PDA por invitación** si Talency ya tiene licencia y una analista certificada (es lo más barato y rápido). Si no la tiene, **(B) IPIP validado + psicóloga de Talency**. **(C) Proveedor con API** (Thomas, TestGorilla) solo si Eugenia quiere que lo usen las empresas solas y a escala.

---

## 2. Plan de búsqueda (qué falta y a quién preguntarle)

### 2.1 A Eugenia (primero, porque cambia todo lo demás)
Ver §9. Sin esas respuestas no se elige camino.

### 2.2 A PDA International (comercial / partners)
Contacto: formulario de demo en https://www.pdainternational.net/contacto/ (también `consulting@pdainternational.net`, que figura en su manual técnico). Mejor que lo pida Talency como cliente.

| # | Pregunta | Por qué |
|---|---|---|
| PDA-1 | ¿Tienen **API** para un portal propio (no un ATS del catálogo)? ¿Documentación, autenticación, webhooks de "evaluación completada"? | En la web no aparece ninguna. Las integraciones con Lever/Teamtailor indican que algo hay. |
| PDA-2 | ¿Se puede **generar un link de evaluación por candidato** desde la cuenta de Talency y que el resultado vuelva por mail/API? | Es la base del flujo "por invitación". |
| PDA-3 | ¿Qué **resultados puede mostrar Talency a terceros** (empresas clientes de BBJobs)? ¿El PDF completo, un resumen, solo el "estilo"? ¿Por escrito? | Los informes son propiedad de PDA y la licencia es intransferible. |
| PDA-4 | ¿Se puede **guardar el informe** en BBJobs? ¿Por cuánto tiempo? ¿Qué pasa al terminar el contrato? | La licencia está "limitada al tiempo de vigencia del contrato". |
| PDA-5 | **Precio**: ¿créditos por evaluación, suscripción, mínimo anual? ¿En pesos o dólares? | No es público. |
| PDA-6 | Rol en datos personales: ¿PDA es **responsable o encargado** del tratamiento de los datos del candidato? ¿Firman un acuerdo de encargo? | Sus términos dicen "según corresponda". |
| PDA-7 | ¿El formulario puede **no pedir género ni fecha de nacimiento**, o al menos no mostrarlos en el informe? | Riesgo de discriminación (Ley 23.592) y regla de BBJobs de no usar edad ni género. |
| PDA-8 | ¿Quién en Talency es **analista certificada PDA**? ¿El informe para terceros requiere esa firma? | Su manual dice que el gráfico lo interpretan analistas certificados. |
| PDA-9 | ¿Tienen **baremos argentinos** y estudios de validez independientes (no propios)? | Lo único publicado es su manual técnico. |

### 2.3 Al Colegio de Psicólogos de la Provincia de Buenos Aires, Distrito I (Bahía Blanca)
Bahía Blanca está en el **Distrito I** (Ley 10.381), no en el X. Contacto: no lo confirmé en esta ronda; buscarlo en la web del Colegio provincial (sede en La Plata).

| # | Pregunta |
|---|---|
| COL-1 | Un inventario conductual tipo PDA/DISC usado en selección, ¿es "técnica específicamente psicológica" (art. 2 Ley 10.306) o puede administrarlo e interpretarlo un no psicólogo (analista certificado de RR.HH.)? |
| COL-2 | Si una plataforma online administra el cuestionario y la psicóloga interpreta, ¿qué tiene que firmar ella y qué puede ver la empresa (informe completo, síntesis, apto/no apto)? |
| COL-3 | ¿Hay recomendaciones del Colegio sobre **evaluación psicolaboral online** y sobre devolución al evaluado? |
| COL-4 | ¿Cuánto tiempo hay que conservar los protocolos y cómo se destruyen? |

### 2.4 A un abogado (datos personales y laboral)
| # | Pregunta |
|---|---|
| AB-1 | Un **perfil psicológico/conductual**, ¿es dato sensible según la Ley 25.326 (art. 2: "información referente a la salud")? Si no lo es, ¿qué resguardos igual conviene tomar? |
| AB-2 | Redacción del **consentimiento separado** (para hacer el test y, aparte, para que lo vea cada empresa) y de la cláusula en los Términos v3. |
| AB-3 | Si BBJobs guarda informes PDA: ¿BBJobs/Talency es responsable y PDA encargado? ¿Hace falta inscribir la base ante la AAIP? |
| AB-4 | Riesgo de **discriminación** (Ley 23.592) si una empresa descarta por perfil. ¿Hace falta un aviso de que el test no es excluyente? |
| AB-5 | ¿Se le puede **cobrar** al candidato el test? ¿Se le puede exigir para postularse? |

### 2.5 Búsqueda pendiente (segunda ronda, del lado nuestro)
- Proveedores **argentinos** con API: no encontré ninguno claro. Buscar en HiringRoom (marketplace de integraciones) y preguntarle a Eugenia qué usa Talency hoy.
- Precio real de Thomas (Argentina) y si tiene distribuidor local.
- Condiciones exactas del **BFI-2** (la página de Colby dio 403) y del IPIP en castellano de Cupani (¿se puede usar comercialmente la traducción?).
- Texto completo de las **ITC Guidelines on Test Use** (la página de la ITC no cargó).

---

## 3. PDA International

### 3.1 Qué es y qué mide
- Empresa de HR tech fundada en **Buenos Aires en 2007**, con oficinas en España, México y Portugal; dice operar en más de 45 países. Argentina fue cerca del 40 % de su facturación entre 2015 y 2019. Fuente: [Forbes Argentina](https://www.forbesargentina.com/negocios/la-firma-argentina-hr-tech-supero-los-valles-muerte-startups-hoy-opera-45-paises-n42709).
- **Modelo:** el de William M. Marston (1928), el mismo del que salen los DISC. Ejes: **Riesgo, Extroversión, Paciencia, Normas** y un quinto, **Autocontrol**, agregado después. Fuente: [Manual Técnico PDA (es-ES)](https://www.pdainternational.net/varios/PDA-Technical-Manual_es-ES.pdf) y [Manual Técnico](https://pdainternational.net/varios/Manual%20T%C3%A9cnico.pdf).
- **Formato** (coincide con las capturas de Eugenia): 1) datos personales; 2) y 3) **dos listas idénticas de 86 adjetivos**, primero "cómo me describen los demás" (perfil adaptado) y después "cómo soy realmente" (perfil natural); 4) texto libre. Cada adjetivo se asigna a un eje; la puntuación cuenta palabras por eje, las convierte con una muestra normativa ("varios cientos de evaluados") y aplica una línea ipsativa (compara a la persona consigo misma). Fuente: manual técnico, arriba.
- **Quién interpreta:** "Este Gráfico PDA es interpretado por analistas que han sido entrenados debidamente y certificados en el uso del instrumento PDA". Fuente: manual técnico.
- **Para qué no sirve:** no mide inteligencia ni destrezas; población de 16 años o más; 15–20 minutos. Fuente: resumen del manual técnico (búsqueda).

### 3.2 Confiabilidad y validez publicadas (todo del propio fabricante)
| Dato | Valor | Fuente |
|---|---|---|
| Test-retest (≥ 3 meses, n = 1.653) | 78 % natural, 83 % adaptado | Manual técnico, tabla 5 |
| Alfa de Cronbach por eje | 66 %–81 %, promedio 75 % | Manual técnico, tabla 6 |
| Comparación con DiSC (n = 912, jueces) | El manual afirma que el PDA acierta más que el DiSC (55 %) | Manual técnico, tabla 8 |
| Estudios independientes / baremos argentinos | **No encontrados** | — |

Lectura: un alfa de 0,75 es aceptable para un uso descriptivo, no para decidir. Es un manual del vendedor, sin revisión de terceros que haya podido encontrar. Además, en un formato con lista de adjetivos y puntuación ipsativa no se compara bien entre personas, que es justo lo que hace una empresa al elegir candidatos.

### 3.3 Licencia, términos y resultados
Fuente: [Condiciones de uso PDA](https://www.pdainternational.net/condiciones-de-uso/).
- Se rige por las **leyes argentinas**, con tribunales de CABA.
- Los **reportes son "propiedad exclusiva de PDA INTERNATIONAL o de sus licenciantes"**. La licencia del cliente es "no exclusiva, intransferible, revocable" y "limitada al tiempo de vigencia del contrato o suscripción".
- Se prohíbe reproducir o distribuir sus materiales sin autorización, y también la ingeniería inversa.
- Los resultados "son de carácter exclusivamente orientativo" y no pueden ser el único criterio para contratar o promover.
- Datos personales: PDA actúa "como Responsable o como Encargado del Tratamiento según corresponda". Conserva los datos "durante el tiempo necesario".
- **Compartir el informe con terceros:** no lo regula de forma expresa. Por la cláusula de propiedad y de distribución, hay que tomarlo como **no permitido sin autorización escrita**.
- El formulario de las capturas pide aceptar las políticas de PDA, y la newsletter es opcional: el candidato le da datos a PDA directamente, no solo a Talency.

### 3.4 API e integraciones
| Integración | Qué se sabe | Fuente |
|---|---|---|
| Lever | Mandar el PDA desde Lever y que el resultado quede en el perfil del candidato. Lo habilita el representante de PDA. | [Lever Help](https://help.lever.co/hc/en-us/articles/20087401831581) (la página no cargó completa; dato tomado del resultado de búsqueda) |
| Teamtailor | Disparadores que invitan solos a los candidatos a hacer el test conductual | [Teamtailor – PDA](https://www.teamtailor.com/integrations/pda-hrtech) |
| HiringRoom, Rankmi | Listadas como integraciones | [GetApp](https://getapp.com.au/software/2057466/pda-international), [Capterra – Hiring Room](https://www.capterra.com/p/197818/Hiring-Room/) |
| API pública / documentación | **No encontrada.** La web solo dice "Incorporamos múltiples sistemas". | [pdainternational.net](https://www.pdainternational.net/) |
| SSO / webhooks | **No confirmado** | — |

Conclusión: probablemente tengan una API para partners (si no, las integraciones con ATS no existirían), pero no es pública. Hay que pedirla (PDA-1).

### 3.5 Precio
**No es público.** La web solo ofrece "Quiero una demo". Idiomas: ES, EN, PT-BR, PT-PT e italiano según GetApp. Fuentes: [pdainternational.net](https://www.pdainternational.net/), [GetApp](https://getapp.com.au/software/2057466/pda-international).

---

## 4. Alternativas comerciales con API

| Proveedor | Qué mide | Español | API / integración | Precio orientativo | Validez publicada | Fuentes |
|---|---|---|---|---|---|---|
| **Thomas International** (PPA) | Conducta, modelo DISC (Dominancia, Influencia, Estabilidad, Cumplimiento). 24 bloques de 4 adjetivos ("más" y "menos"), ipsativo | Sí (lista de idiomas incluye español) | **API REST pública para partners** (`api.thomas.co/v1`): asignar evaluación, consultar estado, leer perfil. Sin alta online: hay que pedir credenciales. Webhooks "próximamente" (por ahora hay que consultar periódicamente) | Por cotización; tarifa plana o por empleado/mes con mínimo | El fabricante cita versiones internacionales paralelas trabajadas con la Universidad de Cambridge; hay un artículo de 2004 de Thomas España | [developers.thomas.co](https://developers.thomas.co/quickstart), [PPA](https://products.thomas.co/en-gb/personal-profile-analysis-ppa), [Cambridge Psychometrics](https://www.psychometrics.cam.ac.uk/client-showcase/thomas), [GetApp MX](https://www.getapp.com.mx/software/1992415/thomas-international) |
| **TestGorilla** | Biblioteca de más de 350 tests; Big 5 (OCEAN) gratis en el plan Free | Big 5 en español y 11 idiomas más | **API REST pública** (v1.3) para invitar candidatos, links públicos, URL por candidato. **Solo en el plan Plus** | Free: US$ 0; Core desde US$ 215/mes; **Plus desde US$ 520/mes**, pago anual (≈ US$ 6.240/año) | No encontré manual técnico del Big 5. Ellos mismos dicen que el Big 5 **no debe usarse para decidir una contratación** | [Precios](https://www.testgorilla.com/pricing/), [API docs](https://docs.testgorilla.com/), [Soporte API](https://support.testgorilla.com/hc/en-us/articles/9025312232731), [Big 5](https://www.testgorilla.com/it/libreria-di-test/personalita-e-cultura/test-di-big-5-ocean/) |
| **Hogan** (HPI, HDS, MVPI) | Personalidad laboral, riesgos de descarrilamiento, valores | Sí, con distribuidor argentino | **No confirmado.** Fuente secundaria: catálogo de API escaso, integraciones a medida | Por cotización (vía distribuidor) | Muy estudiado (literatura amplia); no lo revisé en esta ronda | [Compass, distribuidor en Buenos Aires](https://info.hoganassessments.com/blog/topic/compass), [GET Compass Latam](https://www.hoganassessments.com/news-events/updates/hogan-announces-get-compass-latam-as-new-distributor), [rfp.wiki](https://www.rfp.wiki/vendors/hogan-assessments) |
| **SHL** (OPQ32) | Personalidad laboral, 32 escalas | Sí (no verificado para es-AR) | Integración con más de 80 ATS (Greenhouse: OAuth 2.0 y webhooks). API vía representante | Por cotización | Muy usado; no revisé el manual en esta ronda | [Greenhouse – SHL](https://support.greenhouse.io/hc/en-us/articles/360060626852-SHL-webhook-integration), [Wikipedia OPQ](https://en.wikipedia.org/wiki/Occupational_Personality_Questionnaires) |
| **Korn Ferry** (ex Talent Q: Dimensions, Drives, Aspects) | Personalidad, motivadores, aptitudes | Sí | **No encontré API pública** | Por cotización | Manual técnico de 2017 | [Manual Aspects 2017](https://www.kornferry.com/content/dam/kornferry/docs/article-migration/TQ-201-KF-Talent-Q-Aspects-DEC-2017.pdf) |
| **Criteria Corp** (CCAT, personalidad, Emotify) | Aptitud cognitiva, personalidad, inteligencia emocional | No confirmado | Más de 50 integraciones con ATS/HRIS; API no verificada | Por cotización, contrato mínimo de 12 meses; prueba gratis de 14 días | No revisado | [Capterra](https://www.capterra.com/p/119740/Criteria/), [fitgap](https://us.fitgap.com/products/criteria) |
| **AssessFirst** (SWIPE) | Personalidad en 5 minutos con imágenes, pensado para el celular | No confirmado | Dice tener "open API" y más de 35 integraciones | No público | Correlación promedio 0,70 con el BFI-2 (dato propio) | [Integraciones/API](https://www.assessfirst.com/en/solutions/integrations-open-api), [Guía técnica 2023](https://hubspot.assessfirst.com/hubfs/Science%20Knowledge%20Hub/Techncial%20guide%20-%20November%202023%20UK_compressed.pdf) |
| **Evaluar.com** | 33 tests psicométricos, 149 competencias, "ajuste" candidato–puesto | Sí (LatAm) | **No confirmado** | No público | Dicen tener baremos por país (dato propio) | [Catálogo 2026](https://knowledge-base.evaluar.com/wp-content/uploads/2025/01/Catalogo-Ene-2026.pdf) |
| **DISC de otros proveedores** (PeopleKeys, White Label DISC, TTI) | DISC | Varía | PeopleKeys: API REST y widget (anuncio de 2017, verificar si sigue). White Label DISC: API. TTI y Wiley: no encontré API | Varía | Varía; el modelo DISC no tiene copyright, pero "DiSC" es marca de Wiley | [PeopleKeys](https://partners.peoplekeys.com/?p=135), [White Label DISC](https://www.capterra.com/p/10039081/White-Label-DISC/), [Wiley sobre DISC](https://discprofile.com/blog/which-disc-is-disc) |
| **Proveedores argentinos** | — | — | **No encontré ninguno con API documentada.** HiringRoom (ATS argentino) integra PDA, no es un proveedor de tests | — | — | Segunda ronda (§2.5) |

**Nota:** los proveedores grandes (Hogan, SHL, Korn Ferry) apuntan a empresas medianas o grandes y cobran por cotización. Para el volumen de un portal de Bahía Blanca, lo más realista es Thomas (si cotiza razonable en Argentina) o TestGorilla Plus.

---

## 5. Instrumentos de dominio público o licencia abierta

| Instrumento | Condiciones de uso | Español / validación argentina | Fuentes |
|---|---|---|---|
| **IPIP** (International Personality Item Pool) | **Dominio público**: se puede "copy, edit, translate, or use them for any purpose", sin pedir permiso ni pagar | Sí, y es lo más sólido. **IPIP-NEO** en muestras argentinas (n = 499, CONICET-UNC): estable, confiable y con validez externa, "puede ser utilizado en muestras argentinas"; baremo local planificado. **Versión breve de 30 ítems** del IPIP-R (Córdoba, n = 910) que controla la tendencia a contestar "sí" a todo. IPIP de 100 ítems (n = 910). Traducción del IPIP tipo 16PF de Edgardo Pérez (UNC) | [ipip.ori.org](https://ipip.ori.org/), [traducciones](https://ipip.ori.org/newTranslations.htm), [Moran, Cupani et al. 2020, Acta de Investigación Psicológica](https://www.scielo.org.mx/pdf/aip/v10n2/2007-4719-aip-10-02-27.pdf) (DOI 10.22201/fpsi.20074719e.2020.2.344), [Cupani, Lorenzo-Seva, Korzeniowski y Azpilicueta 2019, Acta Colombiana de Psicología](https://www.redalyc.org/articulo.oa?id=79859087012) (DOI 10.14718/ACP.2019.22.1.12) |
| **Mini-IPIP** (20 ítems) | Dominio público (IPIP) | Traducción española (Zaragoza/Salamanca). Para Argentina solo un estudio preliminar del **Mini-IPIP6** con jóvenes de Buenos Aires (UCA, n = 298). Los propios autores advierten que las formas breves pueden ser más débiles | [UCA](https://repositorio.uca.edu.ar/bitstream/123456789/15107/1/estudio-preliminar-escala-personalidad.pdf), [traducciones IPIP](https://ipip.ori.org/newTranslations.htm) |
| **HEXACO-60 / PI-R** | Gratis **solo para investigación académica sin fines de lucro**. Para otro uso hay que pedir permiso a los autores. **No permite aplicarlo en una web o app abierta al público** | Hay traducciones al español (Belloch; Ortiz y Romero). Validación argentina no buscada | [hexaco.org](https://hexaco.org/hexaco-inventory) |
| **BFI-2** | **No confirmado** (la página de Colby dio 403). En general se lo conoce como de uso libre para investigación no comercial; hay que verificarlo | Estudio argentino del BFI (no BFI-2) con 549 universitarios (Genise, Ungaretti y Etchezahar) | Pendiente |

**Qué implicaría usar un IPIP en BBJobs**
- Se puede programar dentro de la plataforma, sin licencia ni pago por evaluación. El puntaje sale de una cuenta fija (Likert con ítems invertidos), que es justo la regla del Anexo A.
- Hay que elegir **una versión con validación argentina** (IPIP-NEO o la breve de 30 ítems de Cupani et al.) y usar **exactamente** esos ítems y esa traducción. Si se cambian, se pierde la validez. Conviene escribirle a Marcos Cupani (IIPsi CONICET-UNC) por el texto exacto, el baremo y si se puede usar comercialmente su traducción.
- Mide **personalidad (Big Five)**, no "estilo conductual" como el PDA. El resultado no se va a llamar "Dinámico": va a ser un perfil en 5 dimensiones. Hay que explicárselo a Eugenia.
- La **psicóloga de Talency** revisa el cuestionario antes de publicarlo (Anexo A), interpreta y firma el informe. La plataforma solo administra y calcula.
- Para selección hacen falta baremos de población trabajadora: la validación de Córdoba es general, no laboral.

---

## 6. Marco legal y ético en Argentina

> No es asesoramiento legal. Es lo que dicen los textos; las dudas van al abogado (§2.4) y al Colegio (§2.3).

### 6.1 Ley 25.326 de Protección de Datos Personales
- **Datos sensibles (art. 2):** los que revelan origen racial y étnico, opiniones políticas, convicciones religiosas, filosóficas o morales, afiliación sindical, e "información referente a la salud o a la vida sexual". Fuente: [texto en Biblioteca AFIP](https://biblioteca.afip.gob.ar/dcp/LEY_C_025326_2000_10_04), [Santa Fe](https://www.santafe.gov.ar/index.php/web/content/download/119919/595036/file/ley%20de%20habeas%20data.pdf).
- **¿Un perfil psicológico es dato sensible?** La ley no lo nombra. Un perfil conductual de selección no es un diagnóstico de salud, pero un informe psicológico puede rozar la salud mental, y las convicciones "morales" están en la lista. **No encontré una opinión de la AAIP sobre esto.** Lo prudente es tratarlo **como si fuera sensible**: consentimiento expreso y aparte, acceso restringido, nunca obligatorio (art. 7: nadie puede ser obligado a dar datos sensibles), borrado completo al dar de baja la cuenta.
- **Decisiones automatizadas:** la Resolución AAIP 4/2019 da derecho a pedir que se explique la lógica de una decisión tomada solo con tratamiento automatizado que perjudique a la persona. Fuente: [Beccar Varela](https://beccarvarela.com/novedades/resolucion-de-la-agencia-de-acceso-a-la-informacion-publica-no42019/), [Marval](https://www.marval.com/publicacion/mejores-practicas-en-la-aplicacion-de-la-ley-de-proteccion-de-datos-personales-13318). Otra razón para que **la IA no puntúe ni filtre por test**.

### 6.2 Ley 23.592 (actos discriminatorios)
- Sanciona a quien impida o menoscabe de forma arbitraria derechos por raza, religión, opinión, sexo, caracteres físicos, etc. La Corte la aplica a relaciones laborales ("Álvarez") y en "Pellicori" invirtió la carga de la prueba: alcanza con indicios y el demandado tiene que probar un motivo objetivo. Fuente: [dictamen MPF](https://www.mpf.gob.ar/dictamenes/2019/VAbramovich/octubre/Union_Obreros_CNT_51886_2012_CS1CA1.pdf), [HCDN 4613-D-2023](https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2023/PDF2023/TP2023/4613-D-2023.pdf).
- Hay proyectos de ley (2020, 2022) que prohibirían pedir ciertos datos en selección; no figuran sancionados. Fuente: [HCDN 2029-D-2022](https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2022/PDF2022/TP2022/2029-D-2022.pdf).
- Para BBJobs: el PDA pide **género y fecha de nacimiento**. Esos datos no deberían llegarle a la empresa a través del informe. El test nunca debería ser un filtro automático.

### 6.3 Ejercicio de la psicología: ¿quién administra, interpreta y firma?
- **Ley 23.277 rige solo en CABA** y territorios nacionales, no en Bahía Blanca. Define como ejercicio profesional el diagnóstico de la personalidad y la emisión de informes. Prohíbe prestar la firma (art. 5). Su decreto 905/95 pide técnicas reconocidas académicamente. Fuente: [Ley 23.277](https://www.argentina.gob.ar/normativa/nacional/ley-23277-1985-20059/texto), [Decreto 905/95](https://www.argentina.gob.ar/normativa/nacional/decreto-905-1995-31377/texto).
- **En la Provincia de Buenos Aires rige la Ley 10.306** (texto sistematizado). Fuente: [HCD PBA](https://intranet.hcdiputados-ba.gov.ar/refleg/sw10306.pdf).
  - Art. 2: es ejercicio de la psicología aplicar el conocimiento psicológico y sus técnicas en "la investigación y exploración de la estructura psicológica humana… el diagnóstico, pronóstico y tratamiento de la personalidad" y en "la emisión… de consultas, estudios, consejos, informes, dictámenes, peritajes, certificaciones".
  - Art. 4: solo pueden ejercerla psicólogos y licenciados (incluidos los psicólogos laborales) **con matrícula**.
  - Art. 5: las prestaciones psicológicas en **instituciones** las hacen profesionales matriculados.
  - Art. 6: actuación personal; prohibida la cesión de título o firma.
  - Art. 9 a): prohíbe usar procedimientos rechazados por centros universitarios o científicos reconocidos.
- **Código de Ética del Colegio de Psicólogos PBA** (Res. 1670/20). Fuente: [Código](https://bvs-psi.mdp.edu.ar/wp-content/uploads/2024/07/Codigo-Etica-aprobado-Res_1670_20-1-1.pdf).
  - Art. 7: no usar procedimientos que no estén "suficientemente contrastados y validados"; si se prueba un instrumento nuevo, avisar y pedir consentimiento.
  - Art. 17: solo se firma un informe que uno mismo hizo.
  - Art. 19: técnicas avaladas por la comunidad científica, solo en el ámbito profesional.
  - Art. 20: no se pueden **derivar funciones de la profesión en personas no habilitadas**.
  - Arts. 52–53: si el empleador pide algo contrario a la ética, prima el interés del evaluado.
- **Código de Ética de la FePRA**. Fuente: [FePRA](https://fepra.org.ar/wp-content/uploads/2021/06/Codigo-de-E%CC%81tica-de-la-FePRA.pdf).
  - Consentimiento informado (cap. 1).
  - Informes a instituciones sin el material reservado y con precauciones si van a lugares donde no se puede cuidar la privacidad (2.2).
  - Confidencialidad al guardar, transferir y eliminar registros (2.6).
- **Zona gris (para el Colegio, COL-1):** PDA presenta su test como "conductual" y lo hacen interpretar "analistas certificados", que no necesariamente son psicólogos. Leyendo los arts. 2, 4 y 5 de la Ley 10.306, un informe de personalidad para seleccionar personal en una consultora parece ejercicio de la psicología. **No encontré una resolución del Colegio que lo diga expresamente.** Si Talency tiene una psicóloga matriculada, la duda desaparece: ella interpreta y firma.

### 6.4 Lineamientos internacionales
- **ITC Guidelines on Test Use** (International Test Commission): competencias del usuario del test, uso ético, devolución, seguridad del material. Se descargan gratis desde la ITC ([IAAP Div. 2](https://www.iaapsy.org/division-2)). En castellano: [Muñiz et al., "Nuevas directrices sobre el uso de los tests", Papeles del Psicólogo 2015](https://www.papelesdelpsicologo.es/pdf/2609.pdf). No pude abrir el texto completo de la ITC en esta ronda.
- **ISO 10667-1/-2:2020** (evaluación de personas en el trabajo): la parte 1 fija las obligaciones del **cliente** (por qué se evalúa, cómo se usan los resultados, competencia de quienes participan) y la parte 2 las del **proveedor** (elegir el método, interpretar, informar). Es paga. Fuente: [AFNOR](https://www.boutique.afnor.org/en-gb/standard/iso-1066712020/assessment-service-delivery-procedures-and-methods-to-assess-people-in-work/xs135981/132559), [ANSI](https://webstore.ansi.org/standards/iso/iso106672020).

### 6.5 Qué tiene que tener el módulo, cualquiera sea el camino
- **Consentimiento** en dos pasos: (1) hacer el test (qué mide, quién lo interpreta, cuánto se guarda); (2) por cada empresa, autorizar que vea el resultado. Revocable.
- **Voluntario**: no puede ser requisito para postularse (art. 7 Ley 25.326, riesgo Ley 23.592).
- **Devolución al evaluado**: el candidato siempre ve su resultado, en lenguaje claro (ya está en el Anexo A). Que la psicóloga pueda dar una devolución si se la piden.
- **Qué ve la empresa**: una síntesis firmada, nunca las respuestas crudas ni datos de género y edad.
- **Conservación**: plazo fijo (a definir con el Colegio y el abogado; el cooldown actual es de 30 días y el PDF promete 180); borrado en `account_deletion.py`; informe en Cloudinary privado.
- **Validez**: solo instrumentos con evidencia publicada; nada casero.

---

## 7. Riesgos

| Riesgo | Detalle | Cómo se evita |
|---|---|---|
| **Derechos de autor del PDA** | Cuestionario y reportes son de PDA; sus términos prohíben reproducirlos. Un "test de 86 adjetivos en dos listas" armado por nosotros sería una copia | No copiar ni parafrasear la lista. Usar el PDA solo a través de su plataforma y con la licencia de Talency |
| **Tests "inspirados en"** | Sin validación no se sabe qué miden. El Código de Ética (art. 7) y la Ley 10.306 (art. 9 a) le impiden a la psicóloga usarlos y firmarlos | Usar un instrumento con validación publicada (IPIP argentino) o uno comercial |
| **Marca DiSC** | El modelo DISC no tiene copyright, pero "DiSC" es marca de Wiley | Si se usa DISC, que sea de un proveedor con licencia; no armar uno propio |
| **Sesgos** | Pedir género y edad; formas breves más débiles; tendencia a contestar "sí" a todo; ipsativo mal usado para comparar personas | No mostrar género ni edad a la empresa; preferir versiones que controlen ese sesgo (Cupani 2019); no rankear candidatos por test |
| **IA interpretando** | Una IA que puntúe o descarte es una decisión automatizada (Res. AAIP 4/2019) y hace ejercicio de la psicología sin matrícula | **Regla del Anexo A: la IA no puntúa.** Como máximo redacta un borrador con plantilla, que la psicóloga revisa y firma. El test no entra en el ranking de "candidatos recomendados" |
| **Mostrar informes a empresas** | Licencia PDA intransferible; dato posiblemente sensible | Autorización escrita de PDA; consentimiento por empresa; solo síntesis |
| **Quedar atados a un proveedor** | Si Talency deja de pagar el PDA, los informes guardados quedan sin licencia | Guardar el "estilo" y el PDF con fecha de vencimiento; consultarlo con PDA (PDA-4) |
| **Promesas de la web** | `contexto_bbjobs.md` promete "evaluaciones validadas" e "interpretación con IA" | Corregir la copy pública cuando se elija camino |

---

## 8. Recomendación

### Camino A — PDA por invitación (con la licencia de Talency)
Es el diseño de §4.8: Talency genera el link en su cuenta de PDA, BBJobs invita y registra el estado, Talency carga el estilo y el PDF, y el candidato da su consentimiento para cada empresa.
- **A favor:** es lo que Eugenia ya conoce y muestra; no hay que validar nada; es producto argentino; el desarrollo es chico; no depende de una API.
- **En contra:** carga manual (Talency copia links y sube resultados); hace falta autorización escrita de PDA para mostrar informes a empresas; el candidato le da sus datos también a PDA (con género y nacimiento); la validez publicada es solo la del fabricante.
- **Costo:** lo que cobre PDA por evaluación o por suscripción (no es público; PDA-5). Desarrollo de BBJobs aparte.
- **Esfuerzo de desarrollo:** **≈ 4–6 días**. Dos tablas, carga de link y resultado en admin, mail `pda_invitation`, consentimiento por empresa, vista de la empresa, borrado en `account_deletion.py`, tests de cruce entre empresas y entre candidatos. Si PDA da una API con webhook, se suman **≈ 3–5 días** para automatizar la invitación y la vuelta del resultado.
- **Condición:** Talency tiene licencia PDA vigente **y** una analista certificada (idealmente también psicóloga matriculada).

### Camino B — Instrumento abierto validado (IPIP) + psicóloga de Talency
Se programa en BBJobs un IPIP con validación argentina (IPIP-NEO o la versión breve de 30 ítems de Cupani et al. 2019). El puntaje sale de una cuenta fija y la psicóloga matriculada de Talency revisa, interpreta y firma la síntesis que ve la empresa.
- **A favor:** sin licencia ni costo por evaluación; todo queda en BBJobs (datos, diseño, sin terceros); evidencia argentina de CONICET-UNC; cumple el Anexo A tal como está escrito; reaprovecha `models/tests.py`.
- **En contra:** mide Big Five, no el "estilo" del PDA (el resultado se ve distinto); necesita sí o sí una psicóloga matriculada con horas para interpretar; no hay baremo laboral local; hay que confirmar el uso comercial de la traducción.
- **Costo:** US$ 0 de licencia. Horas de la psicóloga por informe (de Talency). Desarrollo de BBJobs aparte.
- **Esfuerzo de desarrollo:** **≈ 8–12 días**. Pantalla del cuestionario, cuenta con ítems invertidos, arreglar los tres bugs de `api/v1/tests.py`, cooldown, cola de revisión para la psicóloga, informe con plantilla, consentimiento, vista de la empresa, borrado, tests.
- **Condición:** psicóloga matriculada en Talency y contacto con los autores para el texto exacto.

### Camino C — Proveedor con API (Thomas o TestGorilla)
BBJobs crea la evaluación por API, el candidato la hace en la plataforma del proveedor y el resultado vuelve consultando la API (Thomas) o por la integración (TestGorilla Plus).
- **A favor:** automático y escalable; las empresas podrían pedir tests sin que Talency intervenga; Thomas tiene API pública documentada.
- **En contra:** el costo fijo más alto (TestGorilla Plus ≈ US$ 6.240/año; Thomas por cotización, sin distribuidor argentino confirmado); datos en el exterior; mismas preguntas de licencia para mostrar resultados; TestGorilla dice que su Big 5 no sirve para decidir una contratación; Thomas todavía no tiene webhooks.
- **Costo:** desde ≈ US$ 520/mes (TestGorilla Plus) o lo que cotice Thomas.
- **Esfuerzo de desarrollo:** **≈ 6–10 días**. Autenticación, crear la evaluación, consultas periódicas o webhook, mapeo de resultados, consentimiento, vista de la empresa, borrado, tests.

### En orden
1. **Si Talency ya paga el PDA → A.** Es lo más rápido. Antes de programar hay que tener por escrito las respuestas PDA-3, PDA-4 y PDA-7.
2. **Si no paga el PDA pero tiene psicóloga → B.**
3. **C solo si** Eugenia quiere un producto que las empresas usen solas y está dispuesta a pagar en dólares todos los meses.
4. **Nunca** un test propio "inspirado en el PDA".

Estimaciones de desarrollo hechas de memoria a partir de §4.8 y del código actual; recalcular cuando se cierre el camino.

---

## 8-bis. ¿Hacemos un test propio? (charla con Gael, 19/10/2026)

Gael preguntó si en lugar de licenciar uno se puede **hacer uno nosotros, con IA o sin ella**. La respuesta:

- **Sí, sobre una base validada (camino B).** Las preguntas salen del IPIP (dominio público, con validación
  de CONICET-UNC). Todo lo demás es de BBJobs: la experiencia del candidato, el **puntaje por fórmula**
  (no por IA), los gráficos, el informe y los permisos.
- **La IA sí puede:** redactar el informe en lenguaje claro a partir de puntajes ya calculados (para que
  la psicóloga de Talency lo revise y firme), sugerir preguntas de entrevista según el perfil y explicarle
  al candidato su propio resultado.
- **La IA no:** inventar las preguntas (un test nuevo necesita estudios con cientos de personas para
  demostrar que mide algo; sin eso, descartar a alguien por su resultado expone a Talency por
  discriminación), ni deducir la personalidad leyendo un CV o un texto (no es confiable, tiene sesgos,
  choca con la Ley 10.306 y con la regla "la IA no puntúa").
- **Si Talency no tiene psicóloga matriculada:** arrancar con un cuestionario de **estilo de trabajo y
  preferencias** (solo o en equipo, rutina o variedad, atención al público, horarios). No es un test
  psicológico ni da un perfil de personalidad; sirve para mostrar afinidad, nunca para descartar.
- **Pregunta que define el camino:** ¿Talency tiene una psicóloga matriculada en la Provincia?

## 9. Preguntas para Eugenia

1. **¿Talency tiene licencia PDA vigente?** ¿Con qué modalidad (créditos, suscripción) y cuánto paga por evaluación?
2. **¿Hay una analista certificada PDA en Talency? ¿Hay una psicóloga matriculada en la Provincia de Buenos Aires?** ¿Es la misma persona?
3. **¿Para quién es el test?** ¿Para todos los candidatos, para los que se postulan a búsquedas de Talency, o un servicio que piden las empresas?
4. **¿Quién ve el resultado?** ¿Solo Talency, el candidato, la empresa de la búsqueda? ¿El informe completo o un resumen?
5. **¿Se cobra?** ¿Al candidato (como la revisión de CV), a la empresa, o va incluido en un plan?
6. **¿Es obligatorio u opcional?** (Recomendación: opcional y nunca un requisito para postularse.)
7. ¿Qué quería mostrar con las capturas: que el candidato **haga el PDA dentro de BBJobs** (no se puede sin PDA) o que **BBJobs lo mande al PDA** y guarde el resultado?
8. ¿Se usa hoy algún otro test en Talency (de lápiz y papel o en otra plataforma)? ¿HiringRoom?
9. Si el PDA no se puede mostrar a empresas: ¿le sirve igual un **Big Five validado** que interprete la psicóloga, aunque el resultado no diga "Dinámico"?
10. ¿Cada cuánto se puede repetir el test (hoy 30 días, el PDF promete 180) y cuánto tiempo se guarda?
11. ¿Talency puede hacer el contacto con PDA International (como cliente) y con el Colegio de Psicólogos Distrito I?
