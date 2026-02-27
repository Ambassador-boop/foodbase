'use client';

export default function WithdrawalsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Withdrawals</h1>
        <p className="text-xs text-muted-foreground">Approve and manage business owner withdrawals</p>
      </div>

      <div className="bg-white border border-border rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">No pending withdrawals at this time</p>
      </div>
    </div>
  );
}
