import {
  COUNTRIES,
  URD_ACADEMIC_TITLES,
  URD_PROFESSIONS,
  URD_PROFESSION_SPECIALIZATIONS,
  formatCorporateCustomerId,
  formatEmployeeId,
  formatInvoiceNumber,
  formatReceiptNumber,
  formatSubAccountId,
} from '@ayetis/shared';
import { faker } from '@faker-js/faker';
import {
  CORP_SEQ_START,
  DEMO_EMAIL_DOMAIN,
  DOCUMENT_SEQ_START,
  DOCTOR_SEQ_START,
  EMPLOYEE_SEQ_START,
  FAKER_SEED,
} from './constants';

export function initFaker(): void {
  faker.seed(FAKER_SEED);
}

export function pad(index: number, width = 2): string {
  return String(index + 1).padStart(width, '0');
}

export function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length];
}

export function demoEmail(prefix: string, index: number): string {
  return `${prefix}.${pad(index)}@${DEMO_EMAIL_DOMAIN}`;
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`;
}

export function personName(): { firstName: string; lastName: string } {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  };
}

export function fakeCountry(index: number): string {
  return pick(COUNTRIES, index + 12);
}

export function fakeAddress(index: number) {
  const country = fakeCountry(index);
  return {
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    country,
    postalCode: faker.location.zipCode(),
  };
}

export function fakeMobile(): string {
  return faker.phone.number({ style: 'international' });
}

export function profession(index: number): string {
  return pick(URD_PROFESSIONS, index);
}

export function specialization(index: number): string {
  return pick(URD_PROFESSION_SPECIALIZATIONS, index);
}

export function academicTitle(index: number): string {
  return pick(URD_ACADEMIC_TITLES, index);
}

export function corporateCustomerId(index: number): string {
  return formatCorporateCustomerId(CORP_SEQ_START + index);
}

export function doctorDisplayId(offset: number, index: number): string {
  return `DR-${String(DOCTOR_SEQ_START + offset + index).padStart(8, '0')}`;
}

export function employeeDisplayId(index: number): string {
  return formatEmployeeId(EMPLOYEE_SEQ_START + index);
}

export function subAccountDisplayId(index: number): string {
  return formatSubAccountId(1, corporateCustomerId(index));
}

export function caseDisplayId(index: number): string {
  return `AYT-SEED-${String(index + 1).padStart(4, '0')}`;
}

export function invoiceDisplayId(index: number): string {
  return formatInvoiceNumber(DOCUMENT_SEQ_START + index);
}

export function receiptDisplayId(index: number): string {
  return formatReceiptNumber(DOCUMENT_SEQ_START + index);
}

export function complaintCode(index: number): string {
  return `CMP-SEED-${pad(index)}`;
}

export function departmentCode(index: number): string {
  return `SEED${pad(index)}`;
}

export function discountCode(index: number): string {
  return `SEED${pad(index)}OFF`;
}
