import type { Permission } from '@ayetis/shared';
import type { PermissionCatalogItem } from '@/features/users/api';
import {
  applyTriState,
  getTriState,
  groupCatalog,
  type PermissionTriState,
} from '@/features/users/permissionState';

interface PermissionEditorProps {
  catalog: PermissionCatalogItem[];
  roleDefaults: Permission[];
  grants: Permission[];
  denies: Permission[];
  locked?: boolean;
  lockedMessage?: string;
  onChange: (next: { grants: Permission[]; denies: Permission[] }) => void;
}

const STATE_LABEL: Record<PermissionTriState, string> = {
  default: 'Role default',
  grant: 'Granted',
  deny: 'Denied',
};

export function PermissionEditor({
  catalog,
  roleDefaults,
  grants,
  denies,
  locked = false,
  lockedMessage,
  onChange,
}: PermissionEditorProps) {
  const groups = groupCatalog(catalog);

  function cycle(permission: Permission) {
    if (locked) return;

    const current = getTriState(permission, grants, denies);
    const order: PermissionTriState[] = ['default', 'grant', 'deny'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    onChange(applyTriState(permission, next, grants, denies));
  }

  function setState(permission: Permission, next: PermissionTriState) {
    if (locked) return;
    onChange(applyTriState(permission, next, grants, denies));
  }

  if (locked) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">
        {lockedMessage ?? 'These permissions are locked and cannot be customized.'}
        <p className="mt-3 text-ink">
          Effective access: <span className="font-semibold">{roleDefaults.length}</span> permissions
          (full admin set).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Role default
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Extra grant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Deny
        </span>
      </div>

      {groups.map(([group, items]) => (
        <section key={group} className="overflow-hidden rounded-2xl border border-line bg-white">
          <header className="border-b border-line bg-surface/80 px-4 py-3 text-sm font-semibold text-ink">
            {group}
          </header>
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const state = getTriState(item.value, grants, denies);
              const inDefault = roleDefaults.includes(item.value);

              return (
                <li
                  key={item.value}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    onClick={() => cycle(item.value)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          'h-2.5 w-2.5 shrink-0 rounded-full',
                          state === 'grant'
                            ? 'bg-emerald-500'
                            : state === 'deny'
                              ? 'bg-red-500'
                              : 'bg-slate-300',
                        ].join(' ')}
                      />
                      <p className="font-medium text-ink">{item.label}</p>
                    </div>
                    <p className="mt-0.5 pl-4.5 text-xs text-muted">
                      {item.value}
                      {inDefault ? ' · included in role defaults' : ' · not in role defaults'}
                      {' · '}
                      {STATE_LABEL[state]}
                    </p>
                  </button>

                  <div className="flex gap-1.5 sm:shrink-0">
                    {(['default', 'grant', 'deny'] as PermissionTriState[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setState(item.value, option)}
                        className={[
                          'rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                          state === option
                            ? option === 'grant'
                              ? 'bg-emerald-500 text-white'
                              : option === 'deny'
                                ? 'bg-red-500 text-white'
                                : 'bg-ink text-white'
                            : 'bg-surface text-muted hover:bg-brand-50 hover:text-brand-700',
                        ].join(' ')}
                      >
                        {option === 'default' ? 'Default' : option === 'grant' ? 'Grant' : 'Deny'}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
