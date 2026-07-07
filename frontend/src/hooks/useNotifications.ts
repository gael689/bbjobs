"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";

export interface NotificationItemData {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

const POLL_INTERVAL_MS = 45_000;

export function useNotifications() {
  const { isSignedIn: isAuthenticated } = useAuth();
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchList = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get("/me/notifications");
      setItems(res.data);
      setUnreadCount(res.data.filter((n: NotificationItemData) => !n.is_read).length);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.patch(`/me/notifications/${id}/read`);
    } catch {
      // optimistic update stays; next poll will reconcile
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await api.post("/me/notifications/read-all");
    } catch {
      // optimistic update stays; next poll will reconcile
    }
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) fetchList();
      return next;
    });
  }, [fetchList]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const tick = () => {
      if (document.hidden) return;
      api
        .get("/me/notifications/unread-count")
        .then((res) => {
          if (!cancelled) setUnreadCount(res.data.count ?? 0);
        })
        .catch(() => {});
    };

    tick();
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated]);

  return {
    items: isAuthenticated ? items : [],
    unreadCount: isAuthenticated ? unreadCount : 0,
    loading,
    open,
    toggleOpen,
    close: () => setOpen(false),
    markRead,
    markAllRead,
  };
}
