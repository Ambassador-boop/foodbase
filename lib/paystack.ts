const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paid_at: string;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
    metadata?: Record<string, any>;
  };
}

export async function initializePayment(
  amount: number,
  email: string,
  reference: string,
  metadata?: Record<string, any>
): Promise<PaystackInitializeResponse> {
  // Get the base URL for redirects - handle both development and production
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://myfoodbase.vercel.app';
  
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}`,
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      email,
      reference,
      redirect_url: `${baseUrl}/api/payments/webhook?reference=${reference}`,
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to initialize payment');
  }

  return response.json();
}

export async function verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to verify payment');
  }

  return response.json();
}

export async function getPaymentStatus(reference: string): Promise<string> {
  try {
    const data = await verifyPayment(reference);
    return data.data.status;
  } catch (error) {
    console.error('Error getting payment status:', error);
    throw error;
  }
}

export function generatePaymentReference(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}
