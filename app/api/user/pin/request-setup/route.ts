import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { generateOTP, getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import { generateId } from '@/lib/utils-extended';

export async function POST(request: NextRequest) {
  try {
    // Get and verify token
    const token = await getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const verified = await verifyToken(token);
    if (!verified || !verified.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = verified.userId as string;

    // Get user
    const user = await getOne('SELECT * FROM users WHERE id = $1', [userId]);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate OTP for PIN verification
    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Save OTP to database
    const otpId = generateId('otp');
    await query(
      `INSERT INTO password_reset_otps (id, user_id, email, otp_code, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [otpId, userId, user.email, otp, expiresAt.toISOString()]
    );

    // Send OTP email via Brevo
    const emailSent = await sendOTPEmail(
      user.email,
      otp,
      user.first_name || 'User'
    );

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Verification code sent to your email',
        otpId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] PIN setup request error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
