import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { hashPin } from '@/lib/pin-utils';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { generateId } from '@/lib/utils-extended';

export async function POST(request: NextRequest) {
  try {
    const { otpId, otp, pin } = await request.json();

    if (!otpId || !otp || !pin) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be 4-6 digits' },
        { status: 400 }
      );
    }

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

    // Get OTP record
    const otpRecord = await getOne(
      `SELECT * FROM password_reset_otps 
       WHERE id = $1 AND user_id = $2 AND is_verified = false`,
      [otpId, userId]
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

    // Hash PIN
    const pinHash = await hashPin(pin);

    // Get the active business for this user to use as business_id
    const business = await getOne(
      `SELECT id FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );

    if (!business || !business.id) {
      return NextResponse.json(
        { error: 'No business found for this user' },
        { status: 400 }
      );
    }

    const businessId = business.id;

    // Create PIN record in users table (we'll store it as a field, not in pins table for user PINs)
    // For now, we'll store it in the pins table but marked for user security
    const pinId = generateId('pin');
    const expiresAt2 = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year expiry for user PINs

    await query(
      `INSERT INTO pins (id, business_id, pin_hash, purpose, metadata, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [pinId, businessId, pinHash, 'user_security', JSON.stringify({ user_id: userId }), expiresAt2.toISOString()]
    );

    // Update ALL businesses under this user with the PIN hash for consistency
    await query(
      'UPDATE businesses SET pin_hash = $1 WHERE owner_id = $2',
      [pinHash, userId]
    );

    // Mark OTP as verified
    await query(
      'UPDATE password_reset_otps SET is_verified = true WHERE id = $1',
      [otpId]
    );

    // Update user to set preferred auth mode to PIN if not already set
    await query(
      'UPDATE users SET preferred_auth_mode = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND preferred_auth_mode != $1',
      ['pin', userId]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'PIN set successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] PIN setup error:', error);
    return NextResponse.json(
      { error: 'Failed to set PIN' },
      { status: 500 }
    );
  }
}
