"use client";

import { getNotificationConfig, formatRelativeTime } from "./notification-config";
import type { NotificationItemData } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: NotificationItemData;
  onClick: (notification: NotificationItemData) => void;
}

export default function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { icon: Icon, iconBg, iconColor } = getNotificationConfig(notification.type);

  return (
    <button
      onClick={() => onClick(notification)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F1F5F9] ${
        !notification.is_read ? "bg-[#E6F4F7]/60" : ""
      }`}
    >
      <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          {!notification.is_read && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E8EA3] shrink-0" />
          )}
          <span className="font-semibold text-sm text-[#1C2230] truncate">
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
  );
}
