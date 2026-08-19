"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { getNotificationConfig, formatRelativeTime } from "./notification-config";
import type { NotificationItemData } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: NotificationItemData;
  onClick: (notification: NotificationItemData) => void;
  onDismiss: (id: string) => void;
}

export default function NotificationItem({ notification, onClick, onDismiss }: NotificationItemProps) {
  const { icon: Icon, iconBg, iconColor } = getNotificationConfig(notification.type);

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#F1F5F9] ${
        !notification.is_read ? "bg-[#E6F4F7]/60" : ""
      }`}
    >
      <button onClick={() => onClick(notification)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
        <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            {!notification.is_read && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E8EA3] shrink-0" />
            )}
            <span className="font-semibold text-sm text-[#1C2230] truncate pr-5">
              {notification.title}
            </span>
          </span>
          <span className="block text-sm text-[#64748B] mt-0.5 line-clamp-2">
            {notification.body}
          </span>
          <span className="block text-xs text-[#94A3B8] mt-1">
            {formatRelativeTime(notification.created_at)}
          </span>
        </span>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
        aria-label="Descartar notificación"
        className="absolute top-2.5 right-2.5 p-1 rounded-full text-[#94A3B8] opacity-0 group-hover:opacity-100 hover:bg-[#DDE3EC] hover:text-[#1C2230] transition-all"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
