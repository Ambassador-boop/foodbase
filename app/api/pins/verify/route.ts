import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import {
  comparePin,
  deletePin,
  getPin,
} from '@/lib/pin-utils';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';

async function getUserId(req: NextRequest) {
  let token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) token = req.cookies.get('auth_token')?.value;
  if (!token) return null;
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return (payload as any).userId || (payload as any).id;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { pinId, pin } = await req.json();

    if (!pinId || !pin) {
      return NextResponse.json(
        { error: 'Missing pinId or PIN' },
        { status: 400 }
      );
    }

    // Get the PIN record
    const pinRecord = await getPin(pinId);

    if (!pinRecord) {
      return NextResponse.json(
        { error: 'PIN expired or not found' },
        { status: 400 }
      );
    }

    // Verify PIN belongs to the business
    if (pinRecord.business_id !== business.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get business auth mode and pin_hash
    const businessAuthData = await getOne(
      `SELECT preferred_auth_mode, pin_hash FROM businesses WHERE id = $1`,
      [business.id]
    );
    const authMode = businessAuthData?.preferred_auth_mode || 'sms';

    // Validate PIN/OTP based on auth mode
    let isValid = false;
    if (authMode === 'pin') {
      // For PIN mode, verify against the merchant's saved PIN hash stored in businesses table
      const savedPinHash = businessAuthData?.pin_hash;
      if (!savedPinHash) {
        return NextResponse.json(
          { error: 'PIN authentication not set up' },
          { status: 400 }
        );
      }
      isValid = await comparePin(pin, savedPinHash);
    } else if (authMode === 'email' || authMode === 'sms') {
      // For SMS/Email modes, verify against the generated OTP hash in the PIN record
      isValid = await comparePin(pin, pinRecord.pin_hash);
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 400 }
      );
    }

    // PIN is valid, execute the action based on purpose
    const purpose = pinRecord.purpose;
    const metadata = pinRecord.metadata;

    try {
      if (purpose === 'bank_account') {
        // Save bank account details
        if (metadata?.bank_account_number && metadata?.bank_code && metadata?.bank_account_holder) {
          await query(
            `UPDATE businesses
             SET bank_code = $1, bank_account_number = $2, bank_account_holder = $3
             WHERE id = $4`,
            [
              metadata.bank_code,
              metadata.bank_account_number,
              metadata.bank_account_holder,
              business.id,
            ]
          );
        }
      } else if (purpose === 'withdrawal') {
        // Process withdrawal
        if (metadata?.withdrawal_id) {
          // Mark withdrawal as verified/authorized
          // You may want to update withdrawal status or trigger payment processing
          await query(
            `UPDATE withdrawals SET status = 'approved' WHERE id = $1 AND business_id = $2`,
            [metadata.withdrawal_id, business.id]
          );
        }
      }

      // Delete the used PIN
      await deletePin(pinId);

      return NextResponse.json({
        success: true,
        message: 'PIN verified successfully',
        purpose,
      });
    } catch (actionError) {
      console.error(`[v0] Failed to execute ${purpose} action:`, actionError);
      return NextResponse.json(
        { error: 'Failed to complete action' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[v0] Failed to verify PIN:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
