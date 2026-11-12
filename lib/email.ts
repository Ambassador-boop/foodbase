// Brevo API-based email service (replaces SMTP for better reliability)
// API Reference: https://developers.brevo.com/reference/sendtransacemail

interface BrevoEmailResponse {
  messageId: string;
}

async function sendBrevoEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_EMAIL || 'auth@foodbase.ng';

    if (!apiKey) {
      console.error('[v0] BREVO_API_KEY not configured');
      return false;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'FoodBase',
          email: senderEmail,
        },
        to: [
          {
            email: to,
          },
        ],
        subject: subject,
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[v0] Brevo API error:', error);
      return false;
    }

    const data = (await response.json()) as BrevoEmailResponse;
    console.log('[v0] Email sent via Brevo API:', data.messageId);
    return true;
  } catch (error) {
    console.error('[v0] Email send error:', error);
    return false;
  }
}

export async function sendOTPEmail(
  email: string,
  otp: string,
  userName: string
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #8E3800;">Password Reset Request</h2>
      <p>Hi ${userName},</p>
      <p>You requested a password reset. Use the code below to reset your password. This code expires in 10 minutes.</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
        <h1 style="color: #8E3800; letter-spacing: 5px; margin: 0;">${otp}</h1>
      </div>
      <p style="color: #666;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, 'FoodBase Password Reset Code', htmlContent);
}

export async function sendPINSetupEmail(
  email: string,
  otp: string,
  userName: string
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #8E3800; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">FoodBase PIN Setup</h1>
      </div>
      <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
        <p>Hi ${userName},</p>
        <p>You&apos;ve requested to set up a secure PIN for your FoodBase account. This PIN will protect sensitive operations like updating bank details and processing withdrawals.</p>
        
        <div style="background-color: #fff3e0; border-left: 4px solid #8E3800; padding: 15px; margin: 20px 0; border-radius: 3px;">
          <p style="margin: 0; font-weight: bold; color: #8E3800;">⚠️ Security Notice:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
            <li><strong>Never share this code</strong> with anyone, including FoodBase support</li>
            <li><strong>FoodBase will never</strong> call or message you asking for this code</li>
            <li><strong>Anyone who has this code</strong> can change your security PIN and access your account</li>
            <li><strong>If you did not request this,</strong> secure your email account immediately and contact FoodBase support</li>
          </ul>
        </div>

        <p style="margin-top: 20px; margin-bottom: 10px; font-weight: bold;">Your verification code:</p>
        <div style="background-color: #fff; border: 2px solid #8E3800; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="color: #8E3800; letter-spacing: 8px; margin: 0; font-size: 32px; font-weight: bold;">${otp}</h1>
        </div>
        
        <p style="color: #666; font-size: 13px; margin: 20px 0 0 0;">
          This code expires in <strong>10 minutes</strong>. If you didn't request this PIN setup, please ignore this email and contact our support team immediately.
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 11px; text-align: center; line-height: 1.6;">
          © ${new Date().getFullYear()} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.<br>
          <a href="https://foodbase.ng/support" style="color: #8E3800; text-decoration: none;">Contact Support</a>
        </p>
      </div>
    </div>
  `;

  return sendBrevoEmail(email, 'FoodBase — Secure PIN Setup Verification', htmlContent);
}

export async function sendPaymentNotification(
  email: string,
  businessName: string,
  amount: number,
  orderNumber: string
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #8E3800;">New Order Received</h2>
      <p>You have received a new order!</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Amount:</strong> ${formattedAmount}</p>
        <p><strong>Status:</strong> Payment Confirmed</p>
      </div>
      <p style="color: #666;">Log in to your FoodBase dashboard to view order details and manage preparation.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `New Order Received - ${businessName}`, htmlContent);
}

export async function sendCustomEmail(
  email: string,
  subject: string,
  html: string
): Promise<boolean> {
  return sendBrevoEmail(email, subject, html);
}

/* ==========================================================================
   Batch 3A — restaurant registration email (additive)
   --------------------------------------------------------------------------
   Reuses the existing Brevo sender above. Nothing here changes the OTP mail.
   Facts referenced in these mails are the ones the product actually implements:
   Paystack settlement to the saved bank account, PIN-gated bank changes and
   withdrawals, and instant storefront availability at /{slug}.
   ========================================================================== */

const BRAND = {
  brown: '#8E3800',
  ink: '#1D1A17',
  body: '#4A423B',
  muted: '#6B5D52',
  cream: '#FBF4EE',
  sand: '#F4E9DE',
  line: '#E9DCD0',
  site: 'https://foodbase.ng',
}

function emailShell({ heading, preheader, body }: { heading: string; preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.cream};">
    <span style="display:none;font-size:1px;color:${BRAND.cream};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BRAND.line};border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:20px 28px;border-bottom:1px solid ${BRAND.line};">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:normal;color:${BRAND.brown};letter-spacing:-0.2px;">FoodBase</span>
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted};padding-left:10px;">Restaurants</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px 28px;">
                <h1 style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.2;color:${BRAND.ink};letter-spacing:-0.4px;">${escapeHtml(heading)}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;border-top:1px solid ${BRAND.line};">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.6;color:${BRAND.muted};">
                  FoodBase, in conjunction with Wisdom Technologies.<br>
                  <a href="${BRAND.site}" style="color:${BRAND.brown};text-decoration:none;">foodbase.ng</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${BRAND.body};">${html}</p>`
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px 0;">
    <tr>
      <td style="background:${BRAND.brown};border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}

function factsList(items: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px 0;background:${BRAND.cream};border:1px solid ${BRAND.line};border-radius:8px;">
    <tr><td style="padding:16px 18px;">
      ${items
        .map(
          (item) =>
            `<p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.55;color:${BRAND.body};"><span style="color:${BRAND.brown};font-weight:bold;">&middot;</span>&nbsp; ${item}</p>`,
        )
        .join('')}
    </td></tr>
  </table>`
}

/** Sent immediately on successful self-registration. */
export async function sendRestaurantWelcomeEmail(input: {
  email: string
  ownerName: string
  restaurantName: string
  slug: string
  dashboardUrl: string
}): Promise<boolean> {
  const storefront = `${BRAND.site}/${input.slug}`
  const htmlContent = emailShell({
    heading: `Your kitchen is on FoodBase`,
    preheader: `${input.restaurantName} is live at ${storefront}`,
    body: [
      paragraph(`Hello ${escapeHtml(input.ownerName)},`),
      paragraph(
        `You registered <strong>${escapeHtml(input.restaurantName)}</strong>. The account is active now. Your storefront address is <a href="${storefront}" style="color:${BRAND.brown};">${escapeHtml(storefront.replace('https://', ''))}</a>, and it stays hidden until you publish a menu.`,
      ),
      factsList([
        'Payments land in your FoodBase balance and settle to the bank account you save. Payments settle on the platform schedule shown in Finance.',
        'Withdrawals and bank-detail changes both require your security PIN. Set the PIN before your first payout.',
        'Opening hours, delivery areas and the storefront design are yours to set. Nothing is shared until you publish it.',
      ]),
      button('Open your dashboard', input.dashboardUrl),
      paragraph(
        `The checklist inside the dashboard takes about ten minutes from start to a shareable menu. If you did not create this account, reply to this email and we will close it.`,
      ),
    ].join(''),
  })

  return sendBrevoEmail(input.email, `Your restaurant is live on FoodBase`, htmlContent)
}

/** Non-blocking verification mail. Access is never gated on it. */
export async function sendEmailVerificationEmail(input: {
  email: string
  ownerName: string
  restaurantName: string
  verifyUrl: string
  expiresInHours: number
}): Promise<boolean> {
  const htmlContent = emailShell({
    heading: 'Confirm your email address',
    preheader: `A one-tap confirmation for ${input.restaurantName}`,
    body: [
      paragraph(`Hello ${escapeHtml(input.ownerName)},`),
      paragraph(
        `Confirm this address so order alerts and payout notices reach the right inbox. Your dashboard works either way. The link expires in ${input.expiresInHours} hours.`,
      ),
      button('Confirm email address', input.verifyUrl),
      paragraph(
        `<span style="color:${BRAND.muted};font-size:12.5px;">If the button does not work, paste this address into your browser:<br><span style="word-break:break-all;color:${BRAND.brown};">${escapeHtml(input.verifyUrl)}</span></span>`,
      ),
      paragraph(
        `<span style="color:${BRAND.muted};font-size:12.5px;">If you did not register a restaurant on FoodBase, you can ignore this message.</span>`,
      ),
    ].join(''),
  })

  return sendBrevoEmail(input.email, 'Confirm your email address', htmlContent)
}

/** Internal notice. Sent to ADMIN_NOTIFICATION_EMAIL (falls back to the Brevo sender). */
export async function sendNewRestaurantAdminEmail(input: {
  to: string
  restaurantName: string
  ownerName: string
  email: string
  phone: string
  slug: string
  city: string
  state: string
  createdAt: string
  businessUrl: string
}): Promise<boolean> {
  const rows: Array<[string, string]> = [
    ['Restaurant', input.restaurantName],
    ['Storefront', `/${input.slug}`],
    ['Owner', input.ownerName],
    ['Email', input.email],
    ['Phone', input.phone],
    ['Location', `${input.city}, ${input.state}`],
    ['Registered', input.createdAt],
  ]
  const htmlContent = emailShell({
    heading: 'New restaurant registered',
    preheader: `${input.restaurantName} just created an account`,
    body: [
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px 0;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr>
                <td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${BRAND.muted};width:110px;vertical-align:top;">${escapeHtml(label)}</td>
                <td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.ink};">${escapeHtml(value)}</td>
              </tr>`,
          )
          .join('')}
      </table>`,
      paragraph(
        `The account is active immediately. No approval is required. Use the admin businesses list to review it or suspend it.`,
      ),
      button('Open in admin', input.businessUrl),
    ].join(''),
  })

  return sendBrevoEmail(input.to, `New restaurant: ${input.restaurantName}`, htmlContent)
}
