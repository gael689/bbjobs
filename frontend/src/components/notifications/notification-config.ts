import {
  BriefcaseIcon,
  InboxIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  StarIcon,
  BellAlertIcon,
  BellIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

export interface NotificationTypeConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconColor: string;
}

const TEAL: NotificationTypeConfig = {
  icon: BriefcaseIcon,
  iconBg: "bg-[#E6F4F7]",
  iconColor: "text-[#1E8EA3]",
};

const MUTED: NotificationTypeConfig = {
  icon: InboxIcon,
  iconBg: "bg-[#F1F5F9]",
  iconColor: "text-[#64748B]",
};

const DESTRUCTIVE: NotificationTypeConfig = {
  icon: ExclamationTriangleIcon,
  iconBg: "bg-red-50",
  iconColor: "text-[#EE4444]",
};

const SECONDARY: NotificationTypeConfig = {
  icon: StarIcon,
  iconBg: "bg-[#FBF3EE]",
  iconColor: "text-[#B9825F]",
};

export const NOTIFICATION_CONFIG: Record<string, NotificationTypeConfig> = {
  // Postulación (positivo)
  application_new: TEAL,
  application_in_process: TEAL,
  application_contacted: TEAL,
  // Postulación (neutro)
  application_discarded: MUTED,
  job_closed_applied: MUTED,
  // Verificación (positivo)
  company_verified: { ...TEAL, icon: CheckBadgeIcon },
  company_reactivated: { ...TEAL, icon: CheckBadgeIcon },
  // Verificación (negativo)
  company_rejected: DESTRUCTIVE,
  company_suspended: DESTRUCTIVE,
  job_takedown: DESTRUCTIVE,
  // Habilidad
  skill_approved: { ...SECONDARY, icon: SparklesIcon },
  skill_rejected: { ...SECONDARY, icon: SparklesIcon },
  // Destaque / pago
  job_feature_active: SECONDARY,
  job_feature_rejected: SECONDARY,
  job_feature_expired: SECONDARY,
  admin_payment_received: SECONDARY,
  // Admin — moderación
  admin_company_pending: { ...TEAL, icon: BellAlertIcon },
  admin_company_reapplied: { ...TEAL, icon: BellAlertIcon },
  admin_skill_suggested: { ...TEAL, icon: BellAlertIcon },
};

export const DEFAULT_NOTIFICATION_CONFIG: NotificationTypeConfig = {
  icon: BellIcon,
  iconBg: "bg-[#F1F5F9]",
  iconColor: "text-[#64748B]",
};

export function getNotificationConfig(type: string): NotificationTypeConfig {
  return NOTIFICATION_CONFIG[type] ?? DEFAULT_NOTIFICATION_CONFIG;
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 30) return "recién";
  if (diffSec < 60) return `hace ${diffSec} seg`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "ayer";
  if (diffDay < 7) return `hace ${diffDay} d`;

  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
