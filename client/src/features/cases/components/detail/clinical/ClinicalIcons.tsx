import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function IconBase({ title, children, className = 'h-5 w-5', ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 21a8 8 0 00-16 0" />
      <circle cx="12" cy="8" r="4" />
    </IconBase>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.3L2.8 17.5A2 2 0 004.5 20.5h15a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z" />
    </IconBase>
  );
}

export function IconShield(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </IconBase>
  );
}

export function IconActivity(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 12h3l2.5 6 4-12 2.5 6H20" />
    </IconBase>
  );
}

export function IconCube(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </IconBase>
  );
}

export function IconImage(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-4-4 3-2-1.5L3 17" />
    </IconBase>
  );
}

export function IconScan(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function IconFile(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </IconBase>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </IconBase>
  );
}

export function IconPaperclip(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 12.5l7.5-7.5a3.5 3.5 0 115 5L10 20.5a5 5 0 11-7-7L14 2.5" />
    </IconBase>
  );
}

export function IconMessage(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-5 4V6z" />
    </IconBase>
  );
}

export function IconNote(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 6h8M8 10h8M8 14h5M6 3h12a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z" />
    </IconBase>
  );
}

export function IconClock(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </IconBase>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 13l4 4L19 7" />
    </IconBase>
  );
}

export function IconTooth(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 5c0-1.5 1.5-2.5 4-2.5S16 3.5 16 5c2.2.4 3.5 2 3.5 4.2 0 2.4-1.4 3.8-2.5 5.2-.8 1-1.2 2.3-1.2 3.6 0 1.2-.8 2.5-1.8 2.5s-1.6-1.4-2-3c-.4 1.6-1 3-2 3s-1.8-1.3-1.8-2.5c0-1.3-.4-2.6-1.2-3.6-1.1-1.4-2.5-2.8-2.5-5.2C4.5 7 5.8 5.4 8 5z" />
    </IconBase>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4l9 5-9 5-9-5 9-5z" />
      <path d="M3 14l9 5 9-5" />
    </IconBase>
  );
}
