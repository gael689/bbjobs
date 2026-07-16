"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, BellSlashIcon } from "@heroicons/react/24/outline";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import type { NotificationItemData } from "@/hooks/useNotifications";

export default function NotificationBell({
  align = "right",
  openUpward = false,
}: {
  /** Desde qué borde cuelga el menú — "left" cuando el botón está pegado al borde
   * izquierdo de la pantalla (sidebar de los paneles), si no se corta. */
  align?: "left" | "right";
  /** Abrir hacia arriba — el botón de los paneles está al pie del sidebar. */
  openUpward?: boolean;
}) {
  const router = useRouter();
  const { items, unreadCount, loading, open, toggleOpen, close, markRead, markAllRead } =
    useNotifications();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

  const handleItemClick = (notification: NotificationItemData) => {
    if (!notification.is_read) markRead(notification.id);
    close();
    if (notification.link) router.push(notification.link);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleOpen}
        className="relative p-2 text-[#64748B] hover:text-[#1E8EA3] transition-colors"
        aria-label="Notificaciones"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#1E8EA3] text-white text-[10px] font-bold leading-none animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute w-[360px] max-w-[90vw] bg-gradient-to-b from-white to-[#F8FAFC] border border-white shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_16px_40px_rgba(30,142,163,0.18)] rounded-2xl overflow-hidden z-50 ${
            align === "left" ? "left-0" : "right-0"
          } ${openUpward ? "bottom-full mb-3" : "top-full mt-3"}`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEF2F7]">
            <span className="font-display font-bold text-[#1C2230]">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-[#1E8EA3] hover:text-[#187B8E] transition-colors"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#EEF2F7]">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#64748B]">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
                <BellSlashIcon className="w-8 h-8 text-[#CBD5E1]" />
                <span className="text-sm text-[#64748B]">No tenés notificaciones</span>
              </div>
            ) : (
              items.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={handleItemClick} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
