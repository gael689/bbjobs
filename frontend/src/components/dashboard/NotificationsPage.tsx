"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { BellSlashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import NotificationItem from "@/components/notifications/NotificationItem";
import type { NotificationItemData } from "@/hooks/useNotifications";

type Tab = "unread" | "read" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "unread", label: "Pendientes" },
  { key: "read", label: "Leídas" },
  { key: "all", label: "Todas" },
];

/** Página completa de notificaciones — a diferencia de NotificationBell, NO usa
 * useNotifications() (ese hook ya lo usa el bell del sidebar en todas las páginas del panel;
 * llamarlo de nuevo acá duplicaría el polling). Mantiene su propio estado local y sólo
 * comparte los endpoints REST. */
export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("unread");

  const fetchList = useCallback(() => {
    api.get("/me/notifications")
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  async function markRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      await api.patch(`/me/notifications/${id}/read`);
    } catch {
      // el estado optimista queda; un refresh manual reconcilia
    }
  }

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await api.post("/me/notifications/read-all");
    } catch {
      // no-op
    }
  }

  async function dismiss(id: string) {
    setItems(prev => prev.filter(n => n.id !== id));
    try {
      await api.delete(`/me/notifications/${id}`);
    } catch {
      // el estado optimista queda; un refresh manual reconcilia
    }
  }

  function handleItemClick(notification: NotificationItemData) {
    if (!notification.is_read) markRead(notification.id);
    if (notification.link) router.push(notification.link);
  }

  const unreadCount = items.filter(n => !n.is_read).length;
  const filtered = items.filter(n => tab === "all" ? true : tab === "unread" ? !n.is_read : n.is_read);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-2xl font-display font-bold text-[#1C2230]">Notificaciones</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] transition-colors"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>
      <p className="text-[#64748B] text-sm mb-6">
        {items.length} notificaci{items.length === 1 ? "ón" : "ones"}
        {unreadCount > 0 && <> · <span className="text-[#1E8EA3] font-semibold">{unreadCount} sin leer</span></>}
      </p>

      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors ${
              tab === t.key ? "bg-[#1E8EA3] text-white" : "bg-white border border-[#DDE3EC] text-[#64748B] hover:border-[#9ED4DF]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-center">
            <BellSlashIcon className="w-9 h-9 text-[#CBD5E1]" />
            <span className="text-sm text-[#64748B]">
              {tab === "unread" ? "No tenés notificaciones pendientes" : tab === "read" ? "Todavía no leíste ninguna" : "No tenés notificaciones"}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-[#EEF2F7]">
            {filtered.map(n => (
              <NotificationItem key={n.id} notification={n} onClick={handleItemClick} onDismiss={dismiss} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
