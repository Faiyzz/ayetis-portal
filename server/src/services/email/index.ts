export {
  sendEmail,
  sendTemplatedEmail,
  renderEmailLayout,
  escapeHtml,
  detailsTable,
  type EmailPayload,
  type RenderedEmail,
} from './email.service';

export {
  clarificationRequiredTemplate,
  clarificationRepliedTemplate,
  caseDeliveredTemplate,
  passwordResetTemplate,
} from './templates';
