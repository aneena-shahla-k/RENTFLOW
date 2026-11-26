import nodemailer, { Transporter } from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (isSmtpConfigured) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  }
  return transporter;
}

export function renderRentFlowEmailTemplate(options: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const { title, bodyHtml, ctaLabel, ctaUrl } = options;
  return `
  <!doctype html>
  <html>
    <body style="margin:0;padding:0;background:#F8FAFC;font-family:'Inter',Arial,sans-serif;color:#0F172A;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:#0F172A;padding:24px 32px;color:#FFFFFF;">
                  <span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">RentFlow</span>
                  <span style="display:block;font-size:12px;color:#94A3B8;margin-top:4px;">Rent smarter. Manage better.</span>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <h1 style="margin:0 0 16px;font-size:20px;color:#0F172A;">${title}</h1>
                  <div style="font-size:14px;line-height:1.65;color:#334155;">
                    ${bodyHtml}
                  </div>
                  ${
                    ctaLabel && ctaUrl
                      ? `<div style="margin-top:24px;">
                           <a href="${ctaUrl}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">${ctaLabel}</a>
                         </div>`
                      : ''
                  }
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;">
                  Sent by RentFlow Multi-Tenant Rental Platform. If you did not expect this email, you may safely ignore it.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  try {
    const tx = getTransporter();
    const info = await tx.sendMail({
      from: env.SMTP_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (!isSmtpConfigured && env.NODE_ENV === 'development') {
      console.log(`[Email:DevPreview] To: ${params.to} | Subject: ${params.subject} | Id: ${info.messageId}`);
    }
  } catch (err) {
    // Non-blocking in app flows, log safely without credentials
    console.error('[EmailService] Failed to dispatch email:', (err as Error).message);
  }
}
