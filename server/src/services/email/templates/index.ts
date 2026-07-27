import {
  detailsTable,
  escapeHtml,
  renderEmailLayout,
  type RenderedEmail,
} from '../email.service';

export function clarificationRequiredTemplate(input: {
  doctorName: string;
  caseId: string;
  patientName: string;
  subject: string;
  requiredInfo: string;
  requestedByName: string;
  requestedByRole: string;
  portalUrl: string;
}): RenderedEmail {
  const subject = `Clarification Required for Case ID: ${input.caseId}`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${escapeHtml(input.doctorName)},</p>
    <p style="margin:0 0 12px;">
      Additional information is required for case <strong>${escapeHtml(input.caseId)}</strong>
      before processing can continue.
    </p>
    ${detailsTable([
      ['Case ID', input.caseId],
      ['Patient', input.patientName],
      ['Requested by', `${input.requestedByName} (${input.requestedByRole})`],
      ['Subject', input.subject],
    ])}
    <p style="margin:16px 0 6px;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;">
      Required information
    </p>
    <div style="margin:0 0 8px;padding:14px 16px;background:#F7F7FB;border:1px solid #E5E7EB;border-radius:12px;white-space:pre-wrap;">
      ${escapeHtml(input.requiredInfo)}
    </div>
    <p style="margin:16px 0 0;">
      Please sign in to the portal and respond to this clarification so the team can resume work.
    </p>
  `;

  const text = [
    `Hello ${input.doctorName},`,
    '',
    `Clarification required for Case ID: ${input.caseId}`,
    `Patient: ${input.patientName}`,
    `Subject: ${input.subject}`,
    `Requested by: ${input.requestedByName} (${input.requestedByRole})`,
    '',
    'Required information:',
    input.requiredInfo,
    '',
    `Open portal: ${input.portalUrl}`,
  ].join('\n');

  return {
    subject,
    text,
    html: renderEmailLayout({
      preheader: subject,
      title: subject,
      bodyHtml,
      cta: { label: 'Respond in portal', url: input.portalUrl },
      footerNote: 'Ayetis clarification notice — please respond in the portal for full thread context.',
    }),
  };
}

export function clarificationRepliedTemplate(input: {
  recipientName: string;
  caseId: string;
  patientName: string;
  subject: string;
  doctorName: string;
  replyPreview: string;
  portalUrl: string;
}): RenderedEmail {
  const emailSubject = `Doctor has responded to clarification — Case ${input.caseId}`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(input.doctorName)}</strong> replied to the clarification on case
      <strong>${escapeHtml(input.caseId)}</strong>.
    </p>
    ${detailsTable([
      ['Case ID', input.caseId],
      ['Patient', input.patientName],
      ['Clarification', input.subject],
      ['Doctor', input.doctorName],
    ])}
    <p style="margin:16px 0 6px;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;">
      Doctor reply
    </p>
    <div style="margin:0 0 8px;padding:14px 16px;background:#F7F7FB;border:1px solid #E5E7EB;border-radius:12px;white-space:pre-wrap;">
      ${escapeHtml(input.replyPreview)}
    </div>
    <p style="margin:16px 0 0;">
      Review the full clarification thread in the portal to continue processing.
    </p>
  `;

  const text = [
    `Hello ${input.recipientName},`,
    '',
    `Doctor ${input.doctorName} responded to clarification on Case ${input.caseId}.`,
    `Subject: ${input.subject}`,
    '',
    'Reply:',
    input.replyPreview,
    '',
    `Open portal: ${input.portalUrl}`,
  ].join('\n');

  return {
    subject: emailSubject,
    text,
    html: renderEmailLayout({
      preheader: emailSubject,
      title: 'Doctor replied to clarification',
      bodyHtml,
      cta: { label: 'View clarification thread', url: input.portalUrl },
      footerNote: 'Ayetis internal notice — reply received for an open clarification.',
    }),
  };
}

export function passwordResetTemplate(input: {
  name: string;
  resetUrl: string;
}): RenderedEmail {
  const subject = 'Reset your Ayetis portal password';
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${escapeHtml(input.name)},</p>
    <p style="margin:0 0 12px;">
      We received a request to reset your password. Use the button below to choose a new password.
      This link expires shortly for security.
    </p>
    <p style="margin:16px 0 0;color:#6B7280;font-size:13px;">
      If you did not request this, you can safely ignore this email.
    </p>
  `;

  const text = [
    `Hello ${input.name},`,
    '',
    'Reset your Ayetis portal password using this link:',
    input.resetUrl,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');

  return {
    subject,
    text,
    html: renderEmailLayout({
      preheader: subject,
      title: subject,
      bodyHtml,
      cta: { label: 'Reset password', url: input.resetUrl },
    }),
  };
}

export function caseDeliveredTemplate(input: {
  doctorName: string;
  caseId: string;
  patientName: string;
  deliveredByName: string;
  hasVideo: boolean;
  hasLink: boolean;
  portalUrl: string;
}): RenderedEmail {
  const subject = `Case ${input.caseId} is ready for your review`;
  const assets = [
    input.hasVideo ? 'video explanation' : null,
    input.hasLink ? 'HTML/view link' : null,
  ]
    .filter(Boolean)
    .join(' and ');

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${escapeHtml(input.doctorName)},</p>
    <p style="margin:0 0 12px;">
      Case <strong>${escapeHtml(input.caseId)}</strong> has been approved and delivered.
      ${assets ? `A ${escapeHtml(assets)} is available in the portal.` : ''}
    </p>
    ${detailsTable([
      ['Case ID', input.caseId],
      ['Patient', input.patientName],
      ['Delivered by', input.deliveredByName],
    ])}
    <p style="margin:16px 0 0;">
      Please open the case to review the delivery package, then approve, request modification,
      cancel, or keep it under review.
    </p>
  `;

  const text = [
    `Hello ${input.doctorName},`,
    '',
    `Case ${input.caseId} is ready for your review.`,
    `Patient: ${input.patientName}`,
    `Delivered by: ${input.deliveredByName}`,
    assets ? `Delivery includes: ${assets}` : '',
    '',
    `Open portal: ${input.portalUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    text,
    html: renderEmailLayout({
      preheader: subject,
      title: subject,
      bodyHtml,
      cta: { label: 'Review delivery', url: input.portalUrl },
      footerNote: 'Ayetis delivery notice — respond in the portal to record your decision.',
    }),
  };
}

/** Generic case-event email used for submitted / assigned / QC / doctor events. */
export function caseEventTemplate(input: {
  recipientName: string;
  subject: string;
  headline: string;
  message: string;
  caseId: string;
  patientName?: string;
  portalUrl: string;
  ctaLabel?: string;
}): RenderedEmail {
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 12px;">${escapeHtml(input.message)}</p>
    ${detailsTable([
      ['Case ID', input.caseId],
      ...(input.patientName ? [['Patient', input.patientName] as [string, string]] : []),
    ])}
  `;

  const text = [
    `Hello ${input.recipientName},`,
    '',
    input.message,
    `Case ID: ${input.caseId}`,
    input.patientName ? `Patient: ${input.patientName}` : '',
    '',
    `Open portal: ${input.portalUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: input.subject,
    text,
    html: renderEmailLayout({
      preheader: input.subject,
      title: input.headline,
      bodyHtml,
      cta: { label: input.ctaLabel || 'Open case', url: input.portalUrl },
      footerNote: 'Ayetis portal notification — open the portal for full case context.',
    }),
  };
}
