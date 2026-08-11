import { env } from '../../config/env';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = {
  name: 'Ayetis',
  primary: '#673DE6',
  ink: '#1B1B2F',
  muted: '#6B7280',
  surface: '#F7F7FB',
  line: '#E5E7EB',
  white: '#FFFFFF',
};

type EmailBrandCache = {
  companyName: string;
  logoUrl: string | null;
  at: number;
};

let emailBrandCache: EmailBrandCache | null = null;
const EMAIL_BRAND_TTL_MS = 60_000;

async function resolveEmailBrand(): Promise<{ companyName: string; logoUrl: string | null }> {
  const now = Date.now();
  if (emailBrandCache && now - emailBrandCache.at < EMAIL_BRAND_TTL_MS) {
    return emailBrandCache;
  }
  try {
    const { getBranding } = await import('../../features/settings/settings.service');
    const branding = await getBranding();
    emailBrandCache = {
      companyName: branding.companyName || BRAND.name,
      logoUrl: branding.emailLogoUrl || branding.headerLogoUrl || null,
      at: now,
    };
  } catch {
    emailBrandCache = { companyName: BRAND.name, logoUrl: null, at: now };
  }
  return emailBrandCache;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmailLayout(input: {
  preheader?: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
  companyName?: string;
  logoUrl?: string | null;
}): string {
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>`
    : '';

  const cta = input.cta
    ? `<p style="margin:28px 0 8px;">
        <a href="${escapeHtml(input.cta.url)}"
           style="display:inline-block;background:${BRAND.primary};color:${BRAND.white};text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
          ${escapeHtml(input.cta.label)}
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:${BRAND.muted};word-break:break-all;">
        Or open: ${escapeHtml(input.cta.url)}
      </p>`
    : '';

  const companyName = (input.companyName || emailBrandCache?.companyName || BRAND.name).replace(
    /\s*Portal$/i,
    '',
  );
  const logoUrl = input.logoUrl !== undefined ? input.logoUrl : emailBrandCache?.logoUrl;
  const brandHeader = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" style="max-height:40px;max-width:180px;display:block;" />`
    : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">
                ${escapeHtml(companyName)}<span style="color:${BRAND.primary};">.</span>
              </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};font-family:Georgia,'Times New Roman',serif;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${BRAND.line};">
              ${brandHeader}
              <div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted};">
                Digital Workflow Portal
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};font-size:15px;line-height:1.6;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.ink};">
                ${escapeHtml(input.title)}
              </h1>
              ${input.bodyHtml}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:${BRAND.surface};border-top:1px solid ${BRAND.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted};line-height:1.5;">
              ${input.footerNote ? escapeHtml(input.footerNote) : `This message was sent by the ${companyName} portal. Please do not reply to this email unless instructed.`}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;width:38%;vertical-align:top;font-size:13px;color:${BRAND.muted};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;vertical-align:top;font-size:14px;color:${BRAND.ink};font-family:Arial,Helvetica,sans-serif;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

export function detailsTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};">
    ${rows.map(([label, value]) => detailRow(label, value || '—')).join('')}
  </table>`;
}

let resendClient: import('resend').Resend | null = null;

async function getResend() {
  if (!env.resendApiKey) return null;
  if (!resendClient) {
    const { Resend } = await import('resend');
    resendClient = new Resend(env.resendApiKey);
  }
  return resendClient;
}

/**
 * Send transactional email via Resend.
 * In development without RESEND_API_KEY, logs the message instead of failing.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ id: string | null; mocked: boolean }> {
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const from = env.emailFrom;

  if (!env.resendApiKey) {
    if (env.isDev) {
      console.log('[email:dev-mock]', {
        from,
        to,
        subject: payload.subject,
        text: payload.text,
      });
      return { id: null, mocked: true };
    }
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = await getResend();
  if (!resend) {
    throw new Error('Resend client unavailable');
  }

  const result = await resend.emails.send({
    from,
    to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo,
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to send email');
  }

  return { id: result.data?.id ?? null, mocked: false };
}

export async function sendTemplatedEmail(
  to: string | string[],
  rendered: RenderedEmail,
  options?: { replyTo?: string },
) {
  await resolveEmailBrand();
  return sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: options?.replyTo,
  });
}

/**
 * Prefer DB email template CMS when present; otherwise use code-rendered email.
 */
export async function sendCmsOrFallback(
  to: string | string[],
  templateKey: string,
  vars: Record<string, string>,
  fallback: RenderedEmail,
  options?: { replyTo?: string },
) {
  const brand = await resolveEmailBrand();
  try {
    const { renderEmailTemplate } = await import('../../features/settings/settings.service');
    const cms = await renderEmailTemplate(templateKey, vars);
    if (cms) {
      const html = cms.html.includes('<!DOCTYPE html')
        ? cms.html
        : renderEmailLayout({
            title: cms.subject,
            bodyHtml: cms.html,
            companyName: brand.companyName,
            logoUrl: brand.logoUrl,
          });
      return sendEmail({
        to,
        subject: cms.subject,
        html,
        text: fallback.text,
        replyTo: options?.replyTo,
      });
    }
  } catch (err) {
    console.warn('[email] CMS template lookup failed', err);
  }
  return sendTemplatedEmail(to, fallback, options);
}

export { env };
