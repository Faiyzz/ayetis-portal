import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_TYPE_LABELS,
  notificationCatalog,
  type NotificationChannel,
  type NotificationDto,
  type NotificationUnreadByChannel,
} from '@ayetis/shared';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AuthButton } from '@/features/auth/components/AuthUI';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api';
import { toast } from '@/features/notifications/toastStore';
import { getErrorMessage } from '@/lib/api';

const EMPTY_UNREAD: NotificationUnreadByChannel = {
  status_alerts: 0,
  clarifications: 0,
};

export function NotificationCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const channelParam = searchParams.get('channel');
  const channel: NotificationChannel =
    channelParam === NOTIFICATION_CHANNELS.CLARIFICATIONS
      ? NOTIFICATION_CHANNELS.CLARIFICATIONS
      : NOTIFICATION_CHANNELS.STATUS_ALERTS;

  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadByChannel, setUnreadByChannel] =
    useState<NotificationUnreadByChannel>(EMPTY_UNREAD);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(
    nextChannel = channel,
    nextUnreadOnly = unreadOnly,
  ) {
    setLoading(true);
    try {
      const data = await fetchNotifications({
        page: 1,
        pageSize: 50,
        unreadOnly: nextUnreadOnly,
        channel: nextChannel,
      });
      setItems(data.items);
      setUnreadByChannel(data.unreadByChannel);
    } catch (err) {
      toast().error(getErrorMessage(err, 'Unable to load notifications'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(channel, unreadOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  function setChannel(next: NotificationChannel) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('channel', next);
      return params;
    });
  }

  async function handleMarkAll() {
    try {
      const result = await markAllNotificationsRead(channel);
      setUnreadByChannel(result.unreadByChannel);
      toast().success(`${NOTIFICATION_CHANNEL_LABELS[channel]} marked read`);
      await load(channel, unreadOnly);
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
        setUnreadByChannel((prev) => ({
          ...prev,
          [item.channel]: Math.max(0, prev[item.channel] - 1),
        }));
      } catch {
        // ignore
      }
    }
  }

  const channelUnread = unreadByChannel[channel];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification center"
        subtitle="Status Alerts and Clarifications keep separate unread counts and mark-read actions."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            NOTIFICATION_CHANNELS.STATUS_ALERTS,
            NOTIFICATION_CHANNELS.CLARIFICATIONS,
          ] as const
        ).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setChannel(id)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              channel === id ? 'bg-brand-600 text-white' : 'border border-line text-ink'
            }`}
          >
            {NOTIFICATION_CHANNEL_LABELS[id]}
            {unreadByChannel[id] > 0 ? (
              <span className="ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full bg-white/20 px-1.5 text-xs">
                {unreadByChannel[id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(false);
            void load(channel, false);
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
            void load(channel, true);
          }}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            unreadOnly ? 'bg-brand-600 text-white' : 'border border-line text-ink'
          }`}
        >
          Unread ({channelUnread})
        </button>
        <div className="ml-auto">
          <AuthButton type="button" variant="ghost" onClick={() => void handleMarkAll()}>
            Mark {NOTIFICATION_CHANNEL_LABELS[channel].toLowerCase()} read
          </AuthButton>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Notification catalog</h2>
        <p className="mt-1 text-sm text-muted">
          In-app types, channel, and CMS email template when the event also sends mail.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          {notificationCatalog().map((item) => (
            <li key={item.type} className="rounded-lg border border-line px-3 py-2">
              <p className="font-medium text-ink">{item.label}</p>
              <p className="text-xs text-muted">
                {NOTIFICATION_CHANNEL_LABELS[item.channel]}
                {item.emailTemplateKey ? ` · email: ${item.emailTemplateKey}` : ' · in-app only'}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        {loading ? <p className="text-sm text-muted">Loading…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted">No notifications in this channel.</p>
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
