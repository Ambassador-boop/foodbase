import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOne, query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit';

const ResetPasswordBody = z.object({
  otpId: z.string().trim().min(1, 'This reset link is incomplete').max(100),
  otp: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code from your email'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, ResetPasswordBody, 'Check the code and your new password.');
    if (!parsed.ok) return parsed.response;
    const { otpId, otp, newPassword } = parsed.data;

    // 10 attempts per 10 minutes per connection, and the same again per reset
    // request, so neither one IP nor one code can be guessed through.
    const limitedByIp = await enforceRateLimit(request, RATE_LIMITS.otpVerifyIp);
    if (limitedByIp) return limitedByIp;
    const limitedByCode = await enforceRateLimit(request, RATE_LIMITS.otpVerifyEmail, { identifier: otpId });
    if (limitedByCode) return limitedByCode;

    // Get OTP record
    const otpRecord = await getOne(
      `SELECT * FROM password_reset_otps 
       WHERE id = $1 AND is_verified = false`,
      [otpId]
    );

    if (!otpRecord) {
      return fail('OTP_INVALID', 'Invalid or already used OTP', 400);
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (new Date() > expiresAt) {
      return fail('OTP_EXPIRED', 'OTP has expired', 400);
    }

    // Verify OTP code
    if (otpRecord.otp_code !== otp) {
      return fail('OTP_INVALID', 'Invalid OTP', 400);
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password and mark OTP as verified
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, otpRecord.user_id]
    );

    await query(
      'UPDATE password_reset_otps SET is_verified = true WHERE id = $1',
      [otpId]
    );

    return NextResponse.json(
      { 
        success: true, 
        message: 'Password reset successfully. Please login with your new password.' 
      },
      { status: 200 }
    );
  } catch (error) {
    return handleUnexpected(error, { where: 'POST /api/auth/reset-password', request });
  }
}
