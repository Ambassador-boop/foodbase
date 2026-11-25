import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOne, query } from '@/lib/db';
import { generateOTP } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import { generateId } from '@/lib/utils-extended';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit';

const ForgotPasswordBody = z.object({
  email: z.string().trim().min(1, 'Enter your email address').max(320).email('Enter a valid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, ForgotPasswordBody, 'Enter the email address on your account.');
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    // 5 per hour per email: the send is what costs money and reaches a person.
    const limited = await enforceRateLimit(request, RATE_LIMITS.otpSendEmail, { identifier: email });
    if (limited) return limited;

    // Get user by email
    const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);

    if (!user) {
      // Don't reveal if email exists for security
      return NextResponse.json(
        { success: true, message: 'If email exists, OTP will be sent' },
        { status: 200 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Save OTP to database
    const otpId = generateId('otp');
    await query(
      `INSERT INTO password_reset_otps (id, user_id, email, otp_code, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [otpId, user.id, email, otp, expiresAt.toISOString()]
    );

    // Send OTP email via Brevo
    const emailSent = await sendOTPEmail(
      email,
      otp,
      user.first_name
    );

    if (!emailSent) {
      return fail('EMAIL_UNAVAILABLE', 'Failed to send OTP email', 500);
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'OTP sent to email',
        otpId,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleUnexpected(error, { where: 'POST /api/auth/forgot-password', request });
  }
}
