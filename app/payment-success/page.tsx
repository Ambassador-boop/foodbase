'use client';
export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import PaymentSuccessPageInner from './PaymentSuccessPageInner';

export default function PageWrapper() {
  return (
    <Suspense fallback={<p>Loading Payment Info...</p>}>
      <PaymentSuccessPageInner />
    </Suspense>
  );
}
