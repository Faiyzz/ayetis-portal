import type { ReactNode } from 'react';

export type PropertyRow = {
  label: string;
  value: ReactNode;
};

export function PropertyTable({
  title,
  rows,
  className = '',
  flush = false,
}: {
  title?: string;
  rows: PropertyRow[];
  className?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={`${
        flush ? '' : 'overflow-hidden rounded-xl border border-line bg-white'
      } ${className}`.trim()}
    >
      {title ? (
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        </div>
      ) : null}
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                className="w-[40%] max-w-[12rem] bg-surface/60 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.05em] text-muted align-top"
              >
                {row.label}
              </th>
              <td className="px-4 py-2.5 text-ink align-top">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
