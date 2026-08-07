"""El catálogo de habilidades, tal cual lo escribió Eugenia en `bbjobs modificaciones.pdf`
(páginas 7 y 8, agosto/2026).

El orden **no es alfabético a propósito**: es el orden en que ella las escribió, que agrupa por
afinidad (primero administración y ventas, después depósito, después oficios, al final lo
digital). Reordenar alfabéticamente rompería esa lógica y haría el desplegable más difícil de
recorrer para alguien que busca "lo suyo".

Dos habilidades tienen comportamiento especial en la UI, identificadas por slug:
  - `idiomas` → abre el selector de idioma + nivel (se guardan en la tabla `languages`)
  - `otra`    → habilita un texto libre corto en el perfil del candidato

Este módulo es la fuente de verdad para el seed. La migración `f1a4c7e2b9d8` lleva una copia
congelada de estos datos, como corresponde a una migración de datos: si mañana se agrega una
habilidad acá, se agrega con una migración nueva, no editando la vieja.
"""

# (slug, nombre)
HABILIDADES_BLANDAS = [
    ("comunicacion-efectiva", "Comunicación efectiva"),
    ("trabajo-en-equipo", "Trabajo en equipo"),
    ("responsabilidad-y-compromiso", "Responsabilidad y compromiso"),
    ("organizacion-y-gestion-del-tiempo", "Organización y gestión del tiempo"),
    ("proactividad-e-iniciativa", "Proactividad e iniciativa"),
    ("adaptabilidad-y-flexibilidad", "Adaptabilidad y flexibilidad"),
    ("resolucion-de-problemas", "Resolución de problemas"),
    ("pensamiento-analitico-y-critico", "Pensamiento analítico y crítico"),
    ("orientacion-al-cliente", "Orientación al cliente"),
    ("orientacion-a-resultados", "Orientación a resultados"),
    ("atencion-al-detalle", "Atención al detalle"),
    ("autonomia", "Autonomía"),
    ("liderazgo", "Liderazgo"),
    ("negociacion", "Negociación"),
    ("empatia-y-escucha-activa", "Empatía y escucha activa"),
    ("capacidad-de-aprendizaje", "Capacidad de aprendizaje"),
]

HABILIDADES_TECNICAS = [
    ("excel", "Excel"),
    ("herramientas-de-oficina", "Herramientas de oficina: Word, PowerPoint y Google Workspace"),
    ("sistemas-de-gestion-erp", "Sistemas de gestión / ERP"),
    ("facturacion-y-cobranzas", "Facturación y cobranzas"),
    ("contabilidad-y-conciliaciones", "Contabilidad y conciliaciones"),
    ("manejo-de-caja-y-posnet", "Manejo de caja y posnet"),
    ("atencion-al-cliente", "Atención al cliente"),
    ("ventas", "Ventas"),
    ("crm-y-cartera-de-clientes", "CRM y gestión de cartera de clientes"),
    ("compras-y-proveedores", "Compras y gestión de proveedores"),
    ("control-de-stock-e-inventarios", "Control de stock e inventarios"),
    ("recepcion-despacho-y-pedidos", "Recepción, despacho y preparación de pedidos"),
    ("manejo-de-autoelevador", "Manejo de autoelevador"),
    ("produccion-y-maquinaria", "Producción y manejo de maquinaria"),
    ("mantenimiento-industrial", "Mantenimiento industrial"),
    ("electricidad", "Electricidad"),
    ("mecanica-y-electromecanica", "Mecánica y electromecánica"),
    ("soldadura", "Soldadura"),
    ("lectura-de-planos", "Lectura e interpretación de planos"),
    ("seguridad-e-higiene", "Seguridad e higiene"),
    ("manipulacion-de-alimentos", "Manipulación de alimentos"),
    ("limpieza-y-desinfeccion", "Limpieza y desinfección"),
    ("redes-sociales-y-marketing-digital", "Redes sociales y marketing digital"),
    ("diseno-grafico-canva", "Diseño gráfico / Canva"),
    ("programacion-y-desarrollo-web", "Programación y desarrollo web"),
    ("soporte-tecnico-y-redes", "Soporte técnico y redes informáticas"),
    ("analisis-de-datos-power-bi", "Análisis de datos / Power BI"),
    ("idiomas", "Idiomas"),
    ("operacion-de-maquinaria-pesada", "Operación de maquinaria pesada"),
    ("automatizacion-con-ia", "Automatización de tareas con IA"),
    ("otra", "Otra"),
]

# Idiomas que se ofrecen al elegir la habilidad "Idiomas". Eugenia dejó la lista abierta
# ("inglés, francés, portugués; etc"), así que se cubren los que se piden en Bahía Blanca.
IDIOMAS = [
    "Inglés",
    "Portugués",
    "Italiano",
    "Francés",
    "Alemán",
    "Chino mandarín",
    "Lengua de señas argentina",
    # Segunda tanda, corta a propósito: sólo los que tienen colectividad o
    # inmigración real en la zona. Una lista larga de idiomas que nadie va a
    # elegir hace más lento encontrar el propio, y para el resto está "Otro".
    "Ruso",
    "Ucraniano",
    "Árabe",
    "Guaraní",
]

# Se ofrece al final del selector: el que hable algo que no está en la lista lo
# escribe. El backend guarda `language_name` como texto libre —nunca validó
# contra esta lista— así que esto es sólo darle una puerta al que la necesita,
# sin tocar el modelo. La lista igual sigue existiendo para que la mayoría elija
# y no escriba "ingles", "Ingles" e "INGLÉS" como tres idiomas distintos.
OTRO_IDIOMA = "Otro"
