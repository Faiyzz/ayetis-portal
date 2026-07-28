import type { NotificationDto } from '@ayetis/shared';
import { NOTIFICATION_TYPE_LABELS } from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

export function NotificationCenterPage() {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(nextUnreadOnly = unreadOnly) {
    setLoading(true);
    try {
      const data = await fetchNotifications({
        page: 1,
        pageSize: 50,
        unreadOnly: nextUnreadOnly,
      });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load notifications'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      toast().success('All notifications marked read');
      await load();
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to mark notifications read'));
    }
  }

  async function handleOpen(item: NotificationDto) {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification center"
        subtitle={`${unreadCount} unread · portal alerts for case events also arrive by email when configured.`}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(false);
            void load(false);
          }}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            !unreadOnly ? 'bg-brand-600 text-white' : 'border border-line text-ink'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(true);
            void load(true);
          }}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            unreadOnly ? 'bg-brand-600 text-white' : 'border border-line text-ink'
          }`}
        >
          Unread
        </button>
        <div className="ml-auto">
          <AuthButton type="button" variant="ghost" onClick={() => void handleMarkAll()}>
            Mark all read
          </AuthButton>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        {loading ? <p className="text-sm text-muted">Loading…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted">No notifications.</p>
        ) : null}
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.id}
              className={`py-3 ${item.isRead ? '' : 'bg-brand-50/40 -mx-2 px-2 rounded-lg'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {NOTIFICATION_TYPE_LABELS[item.type] ?? item.type}
                  </p>
                  <p className="font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">{item.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(item.createdAt).toLocaleString()}
                    {!item.isRead ? ' · Unread' : ' · Read'}
                  </p>
                </div>
                {item.link ? (
                  <Link
                    to={item.link}
                    onClick={() => void handleOpen(item)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-300"
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
