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
      <h2 style="color: #8B7500;">Password Reset Request</h2>
      <p>Hi ${userName},</p>
      <p>You requested a password reset. Use the code below to reset your password. This code expires in 10 minutes.</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
        <h1 style="color: #8B7500; letter-spacing: 5px; margin: 0;">${otp}</h1>
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
      <h2 style="color: #8B7500;">New Order Received</h2>
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
