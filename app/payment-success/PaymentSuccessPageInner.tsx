'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader, AlertCircle } from 'lucide-react';

export default function PaymentSuccessPageInner() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      setError('No payment reference provided');
      return;
    }
    verifyPayment();
  }, [reference]);

  const verifyPayment = async () => {
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus('error');
        setError(data.error || 'Payment verification failed');
        return;
      }
      setOrderData(data);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError('Failed to verify payment');
      console.error(err);
    }
  };

  if (status === 'loading') return <LoaderUI />;
  if (status === 'error') return <ErrorUI error={error} reference={reference} />;
  return <SuccessUI orderData={orderData} reference={reference} />;
}

const LoaderUI = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-3">
      <Loader className="w-8 h-8 animate-spin mx-auto text-primary" />
      <p className="text-sm text-muted-foreground">Verifying your payment...</p>
    </div>
  </div>
);

const ErrorUI = ({ error, reference }: { error: string; reference: string | null }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="bg-white border border-red-200 rounded-lg p-8 max-w-md text-center space-y-4">
      <AlertCircle className="w-12 h-12 mx-auto text-red-600" />
      <h1 className="text-lg font-bold text-foreground">Payment Failed</h1>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Link href="/">
        <Button variant="outline" className="w-full">Back to Home</Button>
      </Link>
    </div>
  </div>
);

const SuccessUI = ({ orderData, reference }: { orderData: any; reference: string | null }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="bg-white border border-border rounded-lg p-8 max-w-md text-center space-y-4">
      <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
      <h1 className="text-2xl font-bold text-foreground">Payment Successful!</h1>
      <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1 text-left">
        <div className="flex justify-between">
          <span>Amount Paid:</span>
          <span className="font-medium text-foreground">
            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(orderData?.amount || 0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Reference:</span>
          <span className="font-mono text-xs">{reference}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Your order has been placed successfully. You will receive a confirmation email shortly with order details and estimated delivery time.
      </p>
      <Link href="/">
        <Button className="w-full bg-primary text-white hover:bg-primary-dark h-9">Back to Home</Button>
      </Link>
    </div>
  </div>
);
