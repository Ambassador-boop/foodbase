import { getOne, query } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';

// Format Nigerian phone number to international format for KudiSMS
export function formatNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return '234' + cleaned.slice(1);
  }
  if (cleaned.startsWith('234')) {
    return cleaned;
  }
  return '234' + cleaned;
}

// Generate a random 6-digit PIN
export function generateSixDigitPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash a PIN using bcrypt (for security)
export async function hashPin(pin: string): Promise<string> {
  // Import bcryptjs for hashing
  const bcrypt = await import('bcryptjs');
  const saltRounds = 10;
  return bcrypt.hash(pin, saltRounds);
}

// Compare PIN with hash
export async function comparePin(pin: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(pin, hash);
}

// Send SMS via KudiSMS
export async function sendKudiSMS(
  phoneNumber: string,
  message: string,
  businessId: string,
  purpose: 'bank_account' | 'withdrawal'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.KUDISMS_TOKEN;
  if (!token) {
    console.error('[v0] KUDISMS_TOKEN is not configured');
    return {
      success: false,
      error: 'SMS service not configured',
    };
  }

  // Validate phone number
  if (!phoneNumber || phoneNumber.trim() === '') {
    console.error('[v0] Invalid phone number provided');
    return {
      success: false,
      error: 'Phone number is required',
    };
  }

  const formattedPhone = formatNigerianPhone(phoneNumber);
  console.log('[v0] SMS formatted phone:', formattedPhone, 'original:', phoneNumber);

  try {
    const requestPayload = {
      token,
      senderID: 'FoodBase',
      recipients: formattedPhone,
      message,
      gateway: '2',
    };
    
    console.log('[v0] Sending SMS request:', {
      senderID: requestPayload.senderID,
      recipients: requestPayload.recipients,
      messageLength: requestPayload.message.length,
      gateway: requestPayload.gateway,
    });

    const response = await fetch('https://my.kudisms.net/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    const data = await response.json();
    
    console.log('[v0] KudiSMS response:', {
      status: response.status,
      error_code: data.error_code,
      msg: data.msg,
    });

    // Log the SMS attempt
    await logKudiSMS(businessId, formattedPhone, message, purpose, data);

    if (data.error_code === '000') {
      // Success
      const messageId = data.data?.[0]?.split('|')[1] || data.message_id;
      
      // Update balance if available
      if (data.balance) {
        await updateKudiBalance(data.balance);
      }

      console.log('[v0] SMS sent successfully:', messageId);
      return {
        success: true,
        messageId,
      };
    } else if (data.error_code === '109') {
      console.warn('[v0] No SMS balance available');
      return {
        success: false,
        error: 'No SMS balance available',
      };
    } else {
      const errorMsg = data.msg || `SMS sending failed with error code ${data.error_code}`;
      console.error('[v0] SMS sending failed:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[v0] SMS send exception:', errorMessage, error);
    
    // Log failed attempt
    try {
      await logKudiSMS(businessId, formattedPhone, message, purpose, {
        error_code: 'network_error',
        msg: errorMessage,
      });
    } catch (logError) {
      console.error('[v0] Failed to log SMS error:', logError);
    }

    return {
      success: false,
      error: `Failed to send SMS: ${errorMessage}`,
    };
  }
}

// Create a PIN record
export async function createPin(
  businessId: string,
  pinHash: string,
  purpose: 'bank_account' | 'withdrawal',
  metadata: any,
  authMode: 'pin' | 'sms' | 'email' = 'sms'
): Promise<string> {
  const pinId = generateAlphanumericId(12);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  await query(
    `INSERT INTO pins (id, business_id, pin_hash, purpose, metadata, auth_mode, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [pinId, businessId, pinHash, purpose, JSON.stringify(metadata), authMode, expiresAt, new Date()]
  );

  return pinId;
}

// Get PIN by ID
export async function getPin(pinId: string) {
  return getOne(
    `SELECT * FROM pins WHERE id = $1 AND expires_at > NOW()`,
    [pinId]
  );
}

// Get active PIN for business and purpose
export async function getActivePinForBusiness(
  businessId: string,
  purpose: 'bank_account' | 'withdrawal'
) {
  return getOne(
    `SELECT * FROM pins WHERE business_id = $1 AND purpose = $2 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [businessId, purpose]
  );
}

// Delete PIN
export async function deletePin(pinId: string) {
  await query(`DELETE FROM pins WHERE id = $1`, [pinId]);
}

// Update KudiSMS balance
export async function updateKudiBalance(balance: number) {
  const existingBalance = await getOne(`SELECT * FROM kudi_sms_balance LIMIT 1`);

  if (existingBalance) {
    await query(
      `UPDATE kudi_sms_balance SET balance = $1, last_updated = NOW() WHERE id = $2`,
      [balance, existingBalance.id]
    );
  } else {
    const balanceId = generateAlphanumericId(12);
    await query(
      `INSERT INTO kudi_sms_balance (id, balance, last_updated, created_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [balanceId, balance]
    );
  }
}

// Get current KudiSMS balance
export async function getKudiBalance() {
  return getOne(`SELECT balance, last_updated FROM kudi_sms_balance ORDER BY last_updated DESC LIMIT 1`);
}

// Log KudiSMS attempt
export async function logKudiSMS(
  businessId: string,
  phoneNumber: string,
  message: string,
  purpose: 'bank_account' | 'withdrawal',
  response: any
) {
  const logId = generateAlphanumericId(12);
  const isSuccess = response.error_code === '000';
  const messageId = response.data?.[0]?.split('|')[1] || response.message_id;

  await query(
    `INSERT INTO kudi_sms_logs (id, business_id, phone_number, message, purpose, kudi_message_id, status, error_code, error_message, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
    [
      logId,
      businessId,
      phoneNumber,
      message,
      purpose,
      messageId,
      isSuccess ? 'sent' : 'failed',
      response.error_code,
      response.msg,
      JSON.stringify(response),
    ]
  );
}

// Send PIN via Brevo email
export async function sendBrevoPinEmail(
  email: string,
  pin: string,
  purpose: 'bank_account' | 'withdrawal',
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_EMAIL || 'auth@foodbase.ng';

    if (!apiKey) {
      console.error('[v0] BREVO_API_KEY not configured');
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    const purposeTitle = purpose === 'bank_account' ? 'Bank Account Verification' : 'Withdrawal Authorization';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8E3800;">FoodBase ${purposeTitle}</h2>
        <p>Your verification code is required to proceed with this action.</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="color: #8E3800; letter-spacing: 5px; margin: 0;">${pin}</h1>
        </div>
        <p style="color: #666; font-size: 14px;">${message}</p>
        <p style="color: #999; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.
        </p>
      </div>
    `;

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
            email: email,
          },
        ],
        subject: `FoodBase ${purposeTitle} - Your Verification Code`,
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[v0] Brevo API error:', error);
      return {
        success: false,
        error: 'Failed to send verification email',
      };
    }

    const data = await response.json() as { messageId: string };
    console.log('[v0] PIN email sent via Brevo:', data.messageId);
    return {
      success: true,
    };
  } catch (error) {
    console.error('[v0] PIN email send error:', error);
    return {
      success: false,
      error: 'Failed to send email',
    };
  }
}
