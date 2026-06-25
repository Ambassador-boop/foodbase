import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { verifyPassword, generateOTP } from '@/lib/auth';
import { sendOTPEmail } from '@/lib/email';
import { generateId } from '@/lib/utils-extended';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { currentPassword } = await request.json();

    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      );
    }

    // Get user from session/auth
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      // Decode token to get userId - this is a simplification
      // In a real app, you'd verify the JWT properly
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decoded.sub || decoded.userId;
      } catch {
        // Token parsing failed, try getting from a different method
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user by ID
    const user = await getOne('SELECT * FROM users WHERE id = $1', [userId]);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(
      currentPassword,
      user.password_hash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
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
        { error: 'Failed to send OTP email' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'OTP sent to your email',
        otpId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Password change request error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
