import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { generateOTP } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import { generateId } from '@/lib/utils-extended';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: 'Failed to send OTP email' },
        { status: 500 }
      );
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
    console.error('[v0] Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
