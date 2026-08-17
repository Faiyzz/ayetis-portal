import { EMPTY_TREATMENT_INSTRUCTIONS, type CaseDetailDto } from '@ayetis/shared';
import { buildGoalProgressRows } from './clinicalUtils';

export function ClinicalStatusCard({ caseData }: { caseData: CaseDetailDto }) {
  const rows = buildGoalProgressRows(caseData);
  const ti = { ...EMPTY_TREATMENT_INSTRUCTIONS, ...caseData.treatmentInstructions };

  return (
    <section className="rounded-lg border border-line bg-white px-6 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">Treatment goals</h3>
        {ti.applianceType ? (
          <span className="text-sm text-muted">{ti.applianceType}</span>
        ) : null}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium text-muted">
              <th className="py-2 pr-4 font-medium">Goal</th>
              <th className="py-2 pr-4 font-medium">Target</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                <td className="py-3 pr-4 text-ink">{row.label}</td>
                <td className="py-3 pr-4 text-ink">{row.goal}</td>
                <td className="py-3 text-muted">{row.current}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
