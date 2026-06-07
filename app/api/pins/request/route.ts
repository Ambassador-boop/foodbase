import { NextRequest, NextResponse } from 'next/server';
import { getOne } from '@/lib/db';
import {
  generateSixDigitPin,
  hashPin,
  createPin,
  sendKudiSMS,
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

    const { purpose, metadata } = await req.json();

    // Validate purpose
    if (!['bank_account', 'withdrawal'].includes(purpose)) {
      return NextResponse.json(
        { error: 'Invalid purpose' },
        { status: 400 }
      );
    }

    // Get business phone number
    const businessData = await getOne(
      `SELECT phone FROM businesses WHERE id = $1`,
      [business.id]
    );

    if (!businessData?.phone) {
      return NextResponse.json(
        { error: 'Business phone number not found' },
        { status: 400 }
      );
    }

    // Generate PIN
    const pin = generateSixDigitPin();
    const pinHash = await hashPin(pin);

    // Create PIN record
    const pinId = await createPin(business.id, pinHash, purpose, metadata);

    // Prepare SMS message based on purpose
    let smsMessage: string;
    if (purpose === 'bank_account') {
      smsMessage = `Your FoodBase access PIN is ${pin}. Use this to save your bank account. Valid for 10 minutes. Do not share.`;
    } else if (purpose === 'withdrawal') {
      const amount = metadata?.amount;
      const formattedAmount = amount
        ? `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
        : 'your withdrawal';
      smsMessage = `Your FoodBase access PIN is ${pin}. Use this to authorize your ${formattedAmount} withdrawal. Valid for 10 minutes. Do not share.`;
    } else {
      smsMessage = `Your FoodBase access PIN is ${pin}. Valid for 10 minutes. Do not share.`;
    }

    // Send SMS
    const smsResult = await sendKudiSMS(
      businessData.phone,
      smsMessage,
      business.id,
      purpose
    );

    if (!smsResult.success) {
      return NextResponse.json(
        { error: smsResult.error || 'Failed to send SMS' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PIN sent successfully',
      pinId, // Return this to the frontend for verification
    });
  } catch (error) {
    console.error('[v0] Failed to request PIN:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
