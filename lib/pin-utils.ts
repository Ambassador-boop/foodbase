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
    throw new Error('KUDISMS_TOKEN is not configured');
  }

  const formattedPhone = formatNigerianPhone(phoneNumber);

  try {
    const response = await fetch('https://my.kudisms.net/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        senderID: 'FoodBase',
        recipients: formattedPhone,
        message,
        gateway: '2',
      }),
    });

    const data = await response.json();

    // Log the SMS attempt
    await logKudiSMS(businessId, formattedPhone, message, purpose, data);

    if (data.error_code === '000') {
      // Success
      const messageId = data.data?.[0]?.split('|')[1] || data.message_id;
      
      // Update balance if available
      if (data.balance) {
        await updateKudiBalance(data.balance);
      }

      return {
        success: true,
        messageId,
      };
    } else if (data.error_code === '109') {
      return {
        success: false,
        error: 'No SMS balance available',
      };
    } else {
      return {
        success: false,
        error: data.msg || `SMS sending failed with error code ${data.error_code}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed attempt
    await logKudiSMS(businessId, formattedPhone, message, purpose, {
      error_code: 'network_error',
      msg: errorMessage,
    });

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
  metadata: any
): Promise<string> {
  const pinId = generateAlphanumericId(12);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  await query(
    `INSERT INTO pins (id, business_id, pin_hash, purpose, metadata, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [pinId, businessId, pinHash, purpose, JSON.stringify(metadata), expiresAt, new Date()]
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
