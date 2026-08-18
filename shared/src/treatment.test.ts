import { describe, expect, it } from 'vitest';
import { CASE_CATEGORIES, CASE_TYPES } from './caseTaxonomy';
import {
  ARCH_OPTIONS,
  EMPTY_RECORDS_NUMBERING,
  IMPLANT_PLANNING_MODES,
  IMPRESSION_METHODS,
  PROSTHO_MATERIALS,
  TOOTH_NUMBERING_SYSTEMS,
  TREATMENT_APPROACHES,
  VELOCITY_PER_STAGE,
  firstFieldError,
  isArchOption,
  isCaseComplexity,
  isImplantPlanningMode,
  isImpressionMethod,
  isPaymentStatus,
  isProsthoMaterial,
  isTreatmentApproach,
  isTreatmentSubCategory,
  isTrimlineHeight,
  isVelocityPerStage,
  isWearSchedule,
  isToothNumberingSystem,
  toothDisplayLabel,
  validateDigitalAlignerPart1,
  validateDigitalAlignerPart2,
  validateDigitalAlignerPart3,
  validateImplantSubmit,
  validatePatientCore,
  validateProsthodonticSubmit,
  validateRequiredCaseFiles,
} from './treatment';

const patient = {
  patientName: 'Ada',
  practiceName: 'Clinic One',
  chiefComplaint: 'Crowding',
  caseCategory: CASE_CATEGORIES.DIGITAL_ALIGNER,
  caseType: CASE_TYPES.NEW,
  recordsNumbering: {
    ...EMPTY_RECORDS_NUMBERING,
    impressionMethod: IMPRESSION_METHODS.DIGITAL_SCAN,
    treatArches: ARCH_OPTIONS.BOTH,
    velocityPerStage: VELOCITY_PER_STAGE.TWO_TENTHS,
    retainerRequired: false,
  },
};

describe('treatment form validation', () => {
  it('requires aligner part 1 clinical fields', () => {
    const errors = validateDigitalAlignerPart1({});
    expect(errors.patientName).toBeTruthy();
    expect(errors.practiceName).toBeTruthy();
    expect(firstFieldError(errors)).toBeTruthy();
    expect(Object.keys(validateDigitalAlignerPart1(patient))).toHaveLength(0);
    expect(validateDigitalAlignerPart2()).toEqual({});
    expect(
      validateDigitalAlignerPart1({
        ...patient,
        patientDateOfBirth: '01-02-2020',
      }).patientDateOfBirth,
    ).toBeTruthy();
    expect(
      validateDigitalAlignerPart1({
        ...patient,
        recordsNumbering: {
          ...patient.recordsNumbering!,
          velocityPerStage: VELOCITY_PER_STAGE.OTHER,
          velocityCustomMm: '',
        },
      })['recordsNumbering.velocityCustomMm'],
    ).toBeTruthy();
  });

  it('requires commercial plan on part 3 and prostho/implant fields', () => {
    expect(validateDigitalAlignerPart3({})['commercial.treatmentPlanId']).toBeTruthy();
    expect(
      Object.keys(
        validateDigitalAlignerPart3({
          commercial: {
            treatmentApproach: TREATMENT_APPROACHES.AESTHETIC,
            treatmentSubCategory: 'aesthetic_3-3',
            treatmentPlanId: 'plan-1',
          },
        }),
      ),
    ).toHaveLength(0);

    const prostho = validateProsthodonticSubmit({
      patient,
      prosthoDetails: { restorationTeeth: [], abutmentTeeth: [], material: '' },
    });
    expect(prostho['prosthoDetails.restorationTeeth']).toBeTruthy();
    expect(
      Object.keys(
        validateProsthodonticSubmit({
          patient,
          prosthoDetails: {
            restorationTeeth: ['11'],
            abutmentTeeth: [],
            material: PROSTHO_MATERIALS.ZIRCONIA,
          },
          commercial: { treatmentPlanId: 'plan-1' },
        }),
      ),
    ).toHaveLength(0);

    const implant = validateImplantSubmit({ patient });
    expect(implant['implantDetails.implantSites']).toBeTruthy();
    expect(
      Object.keys(
        validateImplantSubmit({
          patient,
          implantDetails: {
            implantSites: ['16'],
            planningMode: IMPLANT_PLANNING_MODES.SURGICAL,
            cbctAvailable: true,
          },
          commercial: { treatmentPlanId: 'plan-1' },
        }),
      ),
    ).toHaveLength(0);
    expect(validatePatientCore({}).patientName).toBeTruthy();
  });

  it('requires scans, photos, and DICOM per category', () => {
    expect(validateRequiredCaseFiles('digital_aligner', []).files).toBeTruthy();
    expect(validateRequiredCaseFiles('digital_aligner', [{ name: 'scan.stl' }])).toEqual({});
    expect(validateRequiredCaseFiles('prosthodontic', [{ name: 'scan.stl' }]).files).toMatch(
      /photograph/i,
    );
    expect(
      validateRequiredCaseFiles('prosthodontic', [{ name: 'scan.stl' }, { name: 'smile.jpg' }]),
    ).toEqual({});
    expect(validateRequiredCaseFiles('implant', [{ name: 'scan.stl' }]).files).toMatch(/CBCT|DICOM/i);
    expect(
      validateRequiredCaseFiles('implant', [{ name: 'scan.stl' }, { name: 'cbct.dcm' }]),
    ).toEqual({});
  });

  it('maps tooth labels and type guards', () => {
    expect(toothDisplayLabel('11', TOOTH_NUMBERING_SYSTEMS.FDI)).toBe('11');
    expect(toothDisplayLabel('11', TOOTH_NUMBERING_SYSTEMS.UNIVERSAL)).toBeTruthy();
    expect(isArchOption('both')).toBe(true);
    expect(isImpressionMethod('digital_scan')).toBe(true);
    expect(isWearSchedule('1_week')).toBe(true);
    expect(isTrimlineHeight('1mm')).toBe(true);
    expect(isCaseComplexity('3-3')).toBe(true);
    expect(isTreatmentApproach('aesthetic')).toBe(true);
    expect(isTreatmentSubCategory('aesthetic_3-3')).toBe(true);
    expect(isVelocityPerStage('0.2mm')).toBe(true);
    expect(isToothNumberingSystem('fdi')).toBe(true);
    expect(isProsthoMaterial('zirconia')).toBe(true);
    expect(isImplantPlanningMode('surgical')).toBe(true);
    expect(isPaymentStatus('not_billed')).toBe(true);
  });
});
