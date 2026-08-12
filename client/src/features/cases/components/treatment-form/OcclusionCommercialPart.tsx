import {
  AESTHETIC_SUBCATEGORIES,
  ALL_CROSSBITE_OBJECTIVES,
  ALL_DECIDUOUS_TEETH_OPTIONS,
  ALL_IMPROVE_OBJECTIVES,
  ALL_MIDLINE_OBJECTIVES,
  ALL_RELATIONSHIP_OBJECTIVES,
  ALL_SPACE_MANAGEMENT_OPTIONS,
  ALL_TREATMENT_APPROACHES,
  COMPLEX_SUBCATEGORIES,
  CROSSBITE_OBJECTIVE_LABELS,
  DECIDUOUS_TEETH_LABELS,
  EMPTY_CASE_COMMERCIAL,
  EMPTY_OCCLUSION_GOALS,
  IMPROVE_OBJECTIVE_LABELS,
  MIDLINE_OBJECTIVE_LABELS,
  RELATIONSHIP_OBJECTIVE_LABELS,
  SPACE_MANAGEMENT_LABELS,
  TREATMENT_APPROACH_LABELS,
  TREATMENT_APPROACHES,
  TREATMENT_SUBCATEGORY_LABELS,
  type CaseCommercial,
  type FieldErrors,
  type OcclusionGoals,
  type TreatmentPlanDto,
  type TreatmentSubCategory,
} from '@ayetis/shared';
import { TextField } from '@/features/auth/components/AuthUI';
import { FieldError, SectionCard, fieldClassName } from './FieldError';

export function OcclusionCommercialPart({
  occlusion,
  commercial,
  plans,
  errors,
  onOcclusionChange,
  onCommercialChange,
  onApplyDiscount,
  showOcclusion = true,
  requireApproach = true,
}: {
  occlusion: OcclusionGoals;
  commercial: CaseCommercial;
  plans: TreatmentPlanDto[];
  errors?: FieldErrors;
  onOcclusionChange: (patch: Partial<OcclusionGoals>) => void;
  onCommercialChange: (patch: Partial<CaseCommercial>) => void;
  onApplyDiscount: () => void;
  showOcclusion?: boolean;
  requireApproach?: boolean;
}) {
  const occ = { ...EMPTY_OCCLUSION_GOALS, ...occlusion };
  const com = { ...EMPTY_CASE_COMMERCIAL, ...commercial };
  const subcats =
    com.treatmentApproach === TREATMENT_APPROACHES.AESTHETIC
      ? AESTHETIC_SUBCATEGORIES
      : com.treatmentApproach === TREATMENT_APPROACHES.COMPLEX
        ? COMPLEX_SUBCATEGORIES
        : [];

  return (
    <div className={showOcclusion ? 'grid gap-5 lg:grid-cols-2' : 'grid gap-5'}>
      {showOcclusion ? (
      <SectionCard title="Occlusion & treatment goals">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Upper midline (mm)"
            name="upperMidlineMm"
            type="number"
            step="0.1"
            value={occ.upperMidlineMm ?? ''}
            onChange={(e) =>
              onOcclusionChange({
                upperMidlineMm: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Upper midline objective</span>
            <select
              value={occ.upperMidlineObjective}
              onChange={(e) => onOcclusionChange({ upperMidlineObjective: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.upperMidlineObjective')}
            >
              <option value="">—</option>
              {ALL_MIDLINE_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {MIDLINE_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Lower midline (mm)"
            name="lowerMidlineMm"
            type="number"
            step="0.1"
            value={occ.lowerMidlineMm ?? ''}
            onChange={(e) =>
              onOcclusionChange({
                lowerMidlineMm: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Lower midline objective</span>
            <select
              value={occ.lowerMidlineObjective}
              onChange={(e) => onOcclusionChange({ lowerMidlineObjective: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.lowerMidlineObjective')}
            >
              <option value="">—</option>
              {ALL_MIDLINE_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {MIDLINE_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Overjet (mm)"
            name="overjet"
            type="number"
            step="0.1"
            value={occ.overjetMm ?? ''}
            onChange={(e) =>
              onOcclusionChange({
                overjetMm: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Overjet objective</span>
            <select
              value={occ.overjetObjective}
              onChange={(e) => onOcclusionChange({ overjetObjective: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.overjetObjective')}
            >
              <option value="">—</option>
              {ALL_IMPROVE_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {IMPROVE_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Overbite (%)"
            name="overbite"
            type="number"
            value={occ.overbitePercent ?? ''}
            onChange={(e) =>
              onOcclusionChange({
                overbitePercent: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Overbite objective</span>
            <select
              value={occ.overbiteObjective}
              onChange={(e) => onOcclusionChange({ overbiteObjective: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.overbiteObjective')}
            >
              <option value="">—</option>
              {ALL_IMPROVE_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {IMPROVE_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Canine relationship</span>
            <select
              value={occ.canineRelationship}
              onChange={(e) => onOcclusionChange({ canineRelationship: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.canineRelationship')}
            >
              <option value="">—</option>
              {ALL_RELATIONSHIP_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {RELATIONSHIP_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Molar relationship</span>
            <select
              value={occ.molarRelationship}
              onChange={(e) => onOcclusionChange({ molarRelationship: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.molarRelationship')}
            >
              <option value="">—</option>
              {ALL_RELATIONSHIP_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {RELATIONSHIP_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Anterior crossbite</span>
            <select
              value={occ.anteriorCrossbite}
              onChange={(e) => onOcclusionChange({ anteriorCrossbite: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.anteriorCrossbite')}
            >
              <option value="">—</option>
              {ALL_CROSSBITE_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {CROSSBITE_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Posterior crossbite</span>
            <select
              value={occ.posteriorCrossbite}
              onChange={(e) => onOcclusionChange({ posteriorCrossbite: e.target.value })}
              className={fieldClassName(errors, 'occlusionGoals.posteriorCrossbite')}
            >
              <option value="">—</option>
              {ALL_CROSSBITE_OBJECTIVES.map((value) => (
                <option key={value} value={value}>
                  {CROSSBITE_OBJECTIVE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Deciduous teeth</span>
          <select
            value={occ.deciduousTeeth}
            onChange={(e) => onOcclusionChange({ deciduousTeeth: e.target.value })}
            className={fieldClassName(errors, 'occlusionGoals.deciduousTeeth')}
          >
            <option value="">—</option>
            {ALL_DECIDUOUS_TEETH_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {DECIDUOUS_TEETH_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">IPR allowed</legend>
            <div className="flex gap-2">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((opt) => (
                <button
                  key={`ipr-${opt.label}`}
                  type="button"
                  onClick={() => onOcclusionChange({ iprAllowed: opt.value })}
                  className={[
                    'rounded-lg px-4 py-1.5 text-xs font-semibold',
                    occ.iprAllowed === opt.value
                      ? 'bg-brand-600 text-white'
                      : 'border border-line text-ink',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Engagers / attachments</legend>
            <div className="flex gap-2">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((opt) => (
                <button
                  key={`eng-${opt.label}`}
                  type="button"
                  onClick={() => onOcclusionChange({ engagersAllowed: opt.value })}
                  className={[
                    'rounded-lg px-4 py-1.5 text-xs font-semibold',
                    occ.engagersAllowed === opt.value
                      ? 'bg-brand-600 text-white'
                      : 'border border-line text-ink',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Space management</span>
          <select
            value={occ.spaceManagement}
            onChange={(e) => onOcclusionChange({ spaceManagement: e.target.value })}
            className={fieldClassName(errors, 'occlusionGoals.spaceManagement')}
          >
            <option value="">—</option>
            {ALL_SPACE_MANAGEMENT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {SPACE_MANAGEMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Clinical instructions</span>
          <textarea
            value={occ.clinicalInstructions}
            onChange={(e) => onOcclusionChange({ clinicalInstructions: e.target.value })}
            rows={3}
            className={fieldClassName(errors, 'occlusionGoals.clinicalInstructions')}
          />
        </label>
      </SectionCard>
      ) : null}

      <SectionCard title="Commercial information">
        {requireApproach ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Treatment approach *</span>
              <select
                value={com.treatmentApproach}
                onChange={(e) =>
                  onCommercialChange({
                    treatmentApproach: e.target
                      .value as CaseCommercial['treatmentApproach'],
                    treatmentSubCategory: '',
                  })
                }
                className={fieldClassName(errors, 'commercial.treatmentApproach')}
              >
                <option value="">—</option>
                {ALL_TREATMENT_APPROACHES.map((value) => (
                  <option key={value} value={value}>
                    {TREATMENT_APPROACH_LABELS[value]}
                  </option>
                ))}
              </select>
              <FieldError errors={errors} name="commercial.treatmentApproach" />
            </label>

            {com.treatmentApproach ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Sub-category *</span>
                <select
                  value={com.treatmentSubCategory}
                  onChange={(e) => onCommercialChange({ treatmentSubCategory: e.target.value })}
                  className={fieldClassName(errors, 'commercial.treatmentSubCategory')}
                >
                  <option value="">—</option>
                  {subcats.map((value) => (
                    <option key={value} value={value}>
                      {TREATMENT_SUBCATEGORY_LABELS[value as TreatmentSubCategory]}
                    </option>
                  ))}
                </select>
                <FieldError errors={errors} name="commercial.treatmentSubCategory" />
              </label>
            ) : null}
          </>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Treatment plan *</span>
          <select
            value={com.treatmentPlanId || ''}
            onChange={(e) => {
              const plan = plans.find((p) => p.id === e.target.value);
              onCommercialChange({
                treatmentPlanId: plan?.id ?? null,
                treatmentPlanName: plan?.name ?? '',
                unitPrice: plan?.price ?? null,
                currency: plan?.currency ?? 'USD',
                finalPayableAmount: plan?.isFreeDemo ? 0 : (plan?.price ?? null),
                discountAmount: null,
              });
            }}
            className={fieldClassName(errors, 'commercial.treatmentPlanId')}
          >
            <option value="">Select plan…</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.currency} {plan.price.toFixed(2)}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="commercial.treatmentPlanId" />
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <TextField
            label="Discount code"
            name="discount"
            value={com.discountCode}
            onChange={(e) => onCommercialChange({ discountCode: e.target.value })}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={onApplyDiscount}
              className="rounded-xl border border-line px-4 py-3 text-sm font-semibold"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="space-y-1 rounded-lg bg-surface px-3 py-2 text-sm text-muted">
          <p>
            Standard:{' '}
            <span className="text-ink">
              {com.currency}{' '}
              {(plans.find((p) => p.id === com.treatmentPlanId)?.price ?? com.unitPrice ?? 0).toFixed(
                2,
              )}
            </span>
          </p>
          {com.discountAmount ? (
            <p>
              Discount:{' '}
              <span className="text-emerald-700">
                − {com.currency} {Number(com.discountAmount).toFixed(2)}
              </span>
            </p>
          ) : null}
          <p>
            Payable:{' '}
            <span className="font-semibold text-ink">
              {com.currency} {(com.finalPayableAmount ?? com.unitPrice ?? 0).toFixed(2)}
            </span>
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
