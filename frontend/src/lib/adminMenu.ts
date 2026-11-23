import {
  HomeIcon, BuildingOffice2Icon, UsersIcon, BriefcaseIcon, UserPlusIcon, ChartBarIcon,
  ChatBubbleLeftRightIcon, CreditCardIcon, BellIcon, SparklesIcon, MagnifyingGlassCircleIcon,
  MegaphoneIcon, DocumentMagnifyingGlassIcon, BuildingStorefrontIcon, PresentationChartLineIcon,
  BoltIcon, InboxArrowDownIcon, PaperAirplaneIcon, HeartIcon, AtSymbolIcon,
  CpuChipIcon, UserGroupIcon, AdjustmentsHorizontalIcon, ListBulletIcon, PencilSquareIcon, RocketLaunchIcon,
} from "@heroicons/react/24/outline";

/**
 * Mapa del panel de admin, agrupado por área (pedido de Gael, 23/11/2026). Lo usan el menú
 * lateral (`app/dashboard/admin/layout.tsx`) y el Inicio, así los dos muestran siempre lo mismo.
 * Las pestañas de Mails y del Centro de IA tienen su propia dirección (`/mails/casillas`,
 * `/ia/agentes/prospeccion`…) para poder entrar directo desde acá.
 */
export interface AdminLink {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Una línea para la tarjeta del Inicio. */
  desc: string;
  exact?: boolean;
}

export interface AdminGroup {
  key: string;
  title: string;
  /** Para el Inicio: de qué se trata el área. */
  desc: string;
  links: AdminLink[];
}

export const ADMIN_INICIO: AdminLink = {
  href: "/dashboard/admin", label: "Inicio", icon: HomeIcon, desc: "", exact: true,
};

const IA = "/dashboard/admin/ia";
const MAILS = "/dashboard/admin/mails";

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    key: "dia",
    title: "Día a día",
    desc: "Moderación y contacto: lo que se revisa todos los días.",
    links: [
      { href: "/dashboard/admin/empresas", label: "Empresas", icon: BuildingOffice2Icon, desc: "Verificar, rechazar o suspender empresas." },
      { href: "/dashboard/admin/candidatos", label: "Candidatos", icon: UsersIcon, desc: "Todos los perfiles de postulantes." },
      { href: "/dashboard/admin/busquedas", label: "Búsquedas y postulantes", icon: BriefcaseIcon, desc: "Aprobar búsquedas y ver sus postulantes." },
      { href: "/dashboard/admin/mensajes", label: "Mensajes", icon: ChatBubbleLeftRightIcon, desc: "Contacto, arrepentimientos y problemas reportados." },
      { href: "/dashboard/admin/notificaciones", label: "Notificaciones", icon: BellIcon, desc: "Tus avisos dentro del panel." },
    ],
  },
  {
    key: "recomendaciones",
    title: "Recomendaciones",
    desc: "Los candidatos que la IA encuentra para cada búsqueda, y los agentes que los eligen.",
    links: [
      { href: `${IA}/recomendados`, label: "Recomendados por búsqueda", icon: SparklesIcon, desc: "Los mejores candidatos de cada búsqueda, con su porqué.", exact: true },
      { href: `${IA}/agentes/recomendaciones`, label: "Agentes de recomendación", icon: CpuChipIcon, desc: "Lector de CV, Requisitos, Evaluador, Revisor y Resumidor.", exact: true },
    ],
  },
  {
    key: "automaticos",
    title: "Mails automáticos e IA",
    desc: "Los avisos que salen solos, las respuestas que llegan y lo que hace la IA.",
    links: [
      { href: MAILS, label: "Respuestas", icon: InboxArrowDownIcon, desc: "Lo que la gente contesta a nuestros mails.", exact: true },
      { href: `${MAILS}/enviados`, label: "Mails enviados", icon: PaperAirplaneIcon, desc: "Cada mail que salió y si se entregó.", exact: true },
      { href: "/dashboard/admin/textos-mails", label: "Textos de los mails", icon: PencilSquareIcon, desc: "Cambiar el asunto y el texto de cada mail automático, o apagarlo." },
      { href: `${MAILS}/salud`, label: "Salud de los mails", icon: HeartIcon, desc: "Rebotes, quejas y dominios verificados.", exact: true },
      { href: IA, label: "Panorama de la IA", icon: BoltIcon, desc: "Estado, rendimiento y gasto de la IA.", exact: true },
      { href: `${IA}/actividad`, label: "Actividad y acciones", icon: ListBulletIcon, desc: "Qué hizo la IA y lanzarla a mano.", exact: true },
      { href: `${IA}/agentes`, label: "Todos los agentes", icon: UserGroupIcon, desc: "Los 11 agentes de IA, qué hace cada uno y cuánto gasta.", exact: true },
      { href: "/dashboard/admin/modulos", label: "Interruptores", icon: AdjustmentsHorizontalIcon, desc: "Prender y apagar mails, IA y Revisión de CV." },
    ],
  },
  {
    key: "prospeccion",
    title: "Prospección y mails masivos",
    desc: "Conseguir empresas nuevas con mails que salen solos, y mails puntuales a los usuarios.",
    links: [
      { href: "/dashboard/admin/prospeccion", label: "Prospección automática", icon: RocketLaunchIcon, desc: "Los 3 mails que reciben solas las empresas nuevas. Editarlos, prender o pausar." },
      { href: "/dashboard/admin/empresas-potenciales", label: "Empresas a contactar", icon: BuildingStorefrontIcon, desc: "Las empresas que llegan del centro, por etapa." },
      { href: `${MAILS}/casillas`, label: "Casillas de envío", icon: AtSymbolIcon, desc: "Desde qué casillas sale la prospección y su cupo diario.", exact: true },
      { href: "/dashboard/admin/campanas", label: "Campañas a usuarios", icon: MegaphoneIcon, desc: "Mails puntuales a postulantes o empresas registradas, con aprobación." },
      { href: `${IA}/agentes/prospeccion`, label: "Agentes de prospección", icon: CpuChipIcon, desc: "Redactor de campañas y Audiencias.", exact: true },
    ],
  },
  {
    key: "dinero",
    title: "Dinero",
    desc: "Todo lo que se cobra: destacados, Base de Talento y Revisión de CV.",
    links: [
      { href: "/dashboard/admin/pagos", label: "Pagos", icon: CreditCardIcon, desc: "Cada pago de Mercado Pago y su estado." },
      { href: "/dashboard/admin/revisiones-cv", label: "Revisiones de CV", icon: DocumentMagnifyingGlassIcon, desc: "Las compradas: contactar, en curso y entregadas." },
      { href: "/dashboard/admin/talento", label: "Base de Talento", icon: MagnifyingGlassCircleIcon, desc: "Perfiles visibles y créditos de las empresas." },
    ],
  },
  {
    key: "numeros",
    title: "Estadísticas",
    desc: "Cómo viene la plataforma.",
    links: [
      { href: "/dashboard/admin/estadisticas", label: "Estadísticas", icon: ChartBarIcon, desc: "Métricas generales de la plataforma." },
      { href: "/dashboard/admin/metricas", label: "Métricas del sitio", icon: PresentationChartLineIcon, desc: "Visitas, búsquedas y avisos más vistos." },
      { href: "/dashboard/admin/indicadores", label: "Indicadores", icon: SparklesIcon, desc: "Números de la landing y perfil de los postulantes." },
    ],
  },
  {
    key: "config",
    title: "Configuración",
    desc: "Accesos del equipo.",
    links: [
      { href: "/dashboard/admin/nuevo-admin", label: "Nuevo admin", icon: UserPlusIcon, desc: "Dar acceso al equipo de Talency." },
    ],
  },
];

