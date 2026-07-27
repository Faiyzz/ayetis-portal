import type { NotificationDto } from '@ayetis/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api';
import { getErrorMessage } from '@/lib/api';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchNotifications({ page: 1, pageSize: 12 });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silent — bell is non-blocking
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleOpen() {
    setOpen((value) => !value);
    if (!open) await load();
  }

  async function handleItemClick(item: NotificationDto) {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (err) {
        console.error(getErrorMessage(err));
      }
    }
    setOpen(false);
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((entry) => ({ ...entry, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => void handleOpen()}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-brand-50"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M10 18a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-xs font-semibold text-brand-700 hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">No notifications yet.</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="border-b border-line last:border-0">
                    {item.link ? (
                      <Link
                        to={item.link}
                        onClick={() => void handleItemClick(item)}
                        className={`block px-3 py-3 text-left hover:bg-surface ${item.isRead ? '' : 'bg-brand-50/40'}`}
                      >
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>
                        <p className="mt-1 text-[11px] text-muted">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleItemClick(item)}
                        className={`block w-full px-3 py-3 text-left hover:bg-surface ${item.isRead ? '' : 'bg-brand-50/40'}`}
                      >
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
