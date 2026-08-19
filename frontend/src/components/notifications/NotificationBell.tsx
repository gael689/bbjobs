"use client";

import { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BellIcon, BellSlashIcon } from "@heroicons/react/24/outline";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import type { NotificationItemData } from "@/hooks/useNotifications";

const PANEL_WIDTH = 360;
const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 12;

export default function NotificationBell({
  align = "right",
  openUpward = false,
  variant = "icon",
}: {
  /** Desde qué borde cuelga el menú — "left" cuando el botón está pegado al borde
   * izquierdo de la pantalla (sidebar de los paneles), si no se corta. */
  align?: "left" | "right";
  /** Abrir hacia arriba — el botón de los paneles está al pie del sidebar. */
  openUpward?: boolean;
  /** "prominent" — tarjeta con ícono + texto ("Notificaciones" / "N sin leer"), para el
   * sidebar de los paneles. "icon" — sólo el ícono con badge, para la topbar mobile. Reusa
   * el mismo useNotifications() de acá adentro — no lo dupliques externamente, el hook
   * hace polling por intervalo y llamarlo dos veces dobla los requests. */
  variant?: "icon" | "prominent";
}) {
  const router = useRouter();
  const { items, unreadCount, loading, open, toggleOpen, close, markRead, markAllRead, dismiss } =
    useNotifications();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);

  // El panel se porta a document.body: algunos contenedores donde vive la campanita (la
  // navbar pública, por ej.) tienen overflow-hidden para recortar el drawer mobile con
  // bordes redondeados, y eso cortaba el dropdown de notificaciones. Al portarlo afuera
  // calculamos la posición en coordenadas de viewport (fixed) a partir del botón.
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const style: React.CSSProperties = { position: "fixed", width: PANEL_WIDTH, maxWidth: "90vw" };

    if (align === "left") {
      style.left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
    } else {
      style.left = Math.max(VIEWPORT_MARGIN, rect.right - PANEL_WIDTH);
    }

    if (openUpward) {
      style.bottom = window.innerHeight - rect.top + TRIGGER_GAP;
    } else {
      style.top = rect.bottom + TRIGGER_GAP;
    }

    setPanelStyle(style);
  }, [align, openUpward]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
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
      {variant === "prominent" ? (
        <button
          ref={triggerRef}
          onClick={toggleOpen}
          className="w-full flex items-center justify-between gap-3 bg-[#16303A] hover:bg-[#1B3A46] border border-white/[0.06] rounded-[13px] px-3.5 py-3 transition-colors"
          aria-label="Notificaciones"
        >
          <span className="flex items-center gap-2.5">
            <span className="relative w-[30px] h-[30px] rounded-[9px] bg-[#1E8EA3]/20 flex items-center justify-center shrink-0">
              <BellIcon className="w-[15px] h-[15px] text-[#7ED2E2]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-[#D4B7A2] text-[#241C15] text-[9.5px] font-extrabold leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span className="text-left">
              <span className="block text-[12.5px] font-bold text-[#E8EEF0]">Notificaciones</span>
              <span className="block text-[10.5px] text-[#7C939B]">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "Al día"}
              </span>
            </span>
          </span>
        </button>
      ) : (
        <button
          ref={triggerRef}
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
      )}

      {open && panelStyle && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="bg-gradient-to-b from-white to-[#F8FAFC] border border-white shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_16px_40px_rgba(30,142,163,0.18)] rounded-2xl overflow-hidden z-50"
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
                  <NotificationItem key={n.id} notification={n} onClick={handleItemClick} onDismiss={dismiss} />
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
