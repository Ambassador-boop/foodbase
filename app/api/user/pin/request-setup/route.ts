import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { generateOTP } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import { generateId } from '@/lib/utils-extended';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decoded.sub || decoded.userId;
      } catch {
        // Token parsing failed
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
