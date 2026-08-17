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
import { usePermissions } from '@/features/auth/permissions';
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

const CHANNELS = [
  NOTIFICATION_CHANNELS.STATUS_ALERTS,
  NOTIFICATION_CHANNELS.CLARIFICATIONS,
] as const;

export function NotificationCenterPage() {
  const { can, PERMISSIONS } = usePermissions();
  const showCatalog = can(PERMISSIONS.EMAIL_TEMPLATE_MANAGE);
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

  async function load(nextChannel = channel, nextUnreadOnly = unreadOnly) {
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
    if (item.isRead) return;
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

  const channelUnread = unreadByChannel[channel];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notification center"
        subtitle="Your alerts and clarifications. Unread counts stay separate for each tab."
      />

      <div className="inline-flex rounded-xl border border-line bg-white p-1">
        {CHANNELS.map((id) => {
          const active = channel === id;
          const unread = unreadByChannel[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => setChannel(id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                active ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {NOTIFICATION_CHANNEL_LABELS[id]}
              {unread > 0 ? (
                <span
                  className={`ml-2 inline-flex min-w-5 justify-center rounded-full px-1.5 text-xs ${
                    active ? 'bg-white/20' : 'bg-brand-50 text-brand-700'
                  }`}
                >
                  {unread}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'unread'] as const).map((filter) => {
          const active = filter === 'unread' ? unreadOnly : !unreadOnly;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => {
                const next = filter === 'unread';
                setUnreadOnly(next);
                void load(channel, next);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                active ? 'bg-ink text-white' : 'border border-line text-muted hover:text-ink'
              }`}
            >
              {filter === 'all' ? 'All' : `Unread (${channelUnread})`}
            </button>
          );
        })}
        {channelUnread > 0 ? (
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            className="ml-auto text-xs font-semibold text-brand-700 hover:underline"
          >
            Mark {NOTIFICATION_CHANNEL_LABELS[channel].toLowerCase()} read
          </button>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink">
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {unreadOnly
                ? 'Switch to All to see older items in this tab.'
                : 'New case and clarification events will show up here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} onOpen={handleOpen} />
            ))}
          </ul>
        )}
      </section>

      {showCatalog ? <NotificationTypesReference /> : null}
    </div>
  );
}

function NotificationRow({
  item,
  onOpen,
}: {
  item: NotificationDto;
  onOpen: (item: NotificationDto) => void;
}) {
  const typeLabel = NOTIFICATION_TYPE_LABELS[item.type] ?? item.type;
  const body = (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          item.isRead ? 'bg-transparent' : 'bg-brand-600'
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{typeLabel}</p>
        <p className={`mt-0.5 text-sm ${item.isRead ? 'font-medium text-ink' : 'font-semibold text-ink'}`}>
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted">{item.body}</p>
        <p className="mt-1 text-xs text-muted">
          {new Date(item.createdAt).toLocaleString()}
          {!item.isRead ? ' · Unread' : ''}
        </p>
      </div>
      {item.link ? (
        <span className="shrink-0 self-center text-xs font-semibold text-brand-700">Open</span>
      ) : null}
    </div>
  );

  if (!item.link) {
    return <li className={item.isRead ? '' : 'bg-brand-50/50'}>{body}</li>;
  }

  return (
    <li className={item.isRead ? 'hover:bg-slate-50' : 'bg-brand-50/50 hover:bg-brand-50'}>
      <Link to={item.link} onClick={() => void onOpen(item)} className="block">
        {body}
      </Link>
    </li>
  );
}

/** Admin/CMS reference only — not shown to doctors or other end users. */
function NotificationTypesReference() {
  const catalog = notificationCatalog();
  return (
    <details className="group rounded-xl border border-dashed border-line bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>Notification types (admin reference)</span>
          <span className="text-xs font-normal">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3">
        <p className="mb-3 text-xs text-muted">
          Maps each in-app event to a channel and, when mail is sent, the CMS email template.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Channel</th>
                <th className="pb-2 font-medium">Email template</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {catalog.map((item) => (
                <tr key={item.type}>
                  <td className="py-2 pr-3 text-ink">{item.label}</td>
                  <td className="py-2 pr-3 text-muted">
                    {NOTIFICATION_CHANNEL_LABELS[item.channel]}
                  </td>
                  <td className="py-2 font-mono text-xs text-muted">
                    {item.emailTemplateKey ?? 'In-app only'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
