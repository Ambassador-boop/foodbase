import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { otpId, otp, newPassword } = await request.json();

    if (!otpId || !otp || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Get OTP record
    const otpRecord = await getOne(
      `SELECT * FROM password_reset_otps 
       WHERE id = $1 AND is_verified = false`,
      [otpId]
    );

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or already used OTP' },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: 'OTP has expired' },
        { status: 400 }
      );
    }

    // Verify OTP code
    if (otpRecord.otp_code !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP' },
        { status: 400 }
      );
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
    console.error('[v0] Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
