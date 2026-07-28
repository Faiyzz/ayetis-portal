import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

type PageHeaderSlots = {
  titleEl: HTMLElement | null;
  actionsEl: HTMLElement | null;
};

const PageHeaderSlotsContext = createContext<PageHeaderSlots>({
  titleEl: null,
  actionsEl: null,
});

/**
 * Bridges DOM slot refs from AppShell into context so pages can portal
 * their title/subtitle into the sticky top bar.
 */
export function PageHeaderProvider({
  titleRef,
  actionsRef,
  children,
}: {
  titleRef: RefObject<HTMLDivElement | null>;
  actionsRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [slots, setSlots] = useState<PageHeaderSlots>({
    titleEl: null,
    actionsEl: null,
  });

  useLayoutEffect(() => {
    setSlots({
      titleEl: titleRef.current,
      actionsEl: actionsRef.current,
    });
  }, [titleRef, actionsRef]);

  return (
    <PageHeaderSlotsContext.Provider value={slots}>{children}</PageHeaderSlotsContext.Provider>
  );
}

/**
 * Renders page title content into the AppShell top bar (and optional actions
 * before the notification bell). Returns null in the page tree.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional actions rendered in the top bar, before the notification bell. */
  children?: ReactNode;
}) {
  const { titleEl, actionsEl } = useContext(PageHeaderSlotsContext);

  if (!titleEl) return null;

  return (
    <>
      {createPortal(
        <div className="min-w-0">
          {eyebrow ? (
            <div className="truncate text-xs font-medium text-brand-600">{eyebrow}</div>
          ) : null}
          <h1
            className={[
              'truncate text-[15px] font-semibold tracking-tight text-ink sm:text-lg',
              eyebrow ? 'mt-0.5' : '',
            ].join(' ')}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted sm:text-[13px]">{subtitle}</p>
          ) : null}
        </div>,
        titleEl,
      )}
      {children && actionsEl ? createPortal(children, actionsEl) : null}
    </>
  );
}
