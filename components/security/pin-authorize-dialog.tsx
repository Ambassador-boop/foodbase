'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type PinAction = 'withdrawal' | 'refund' | 'bank_account';

const titles: Record<PinAction, string> = { withdrawal: 'Authorize withdrawal', refund: 'Authorize refund', bank_account: 'Confirm bank account change' };

export function PinAuthorizeDialog({ open, action, summary, lockedUntil, onOpenChange, onSubmit, onForgot, loading, error }: { open: boolean; action: PinAction; summary?: string; lockedUntil?: string | null; onOpenChange: (open: boolean) => void; onSubmit: (pin: string) => void; onForgot: () => void; loading?: boolean; error?: string }) {
  const [pin, setPin] = useState('');
  const [remaining, setRemaining] = useState(0);
  useEffect(() => { if (open) setPin(''); }, [open]);
  useEffect(() => { const tick = () => setRemaining(lockedUntil ? Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000)) : 0); tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id); }, [lockedUntil]);
  const locked = remaining > 0;
  const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="fixed bottom-0 top-auto w-full rounded-t-2xl sm:top-1/2 sm:w-[min(100%-2rem,420px)] sm:-translate-y-1/2 sm:rounded-2xl">
    <DialogHeader><DialogTitle>{titles[action]}</DialogTitle><DialogDescription>Enter your PIN to continue.</DialogDescription></DialogHeader>
    {summary && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{summary}</p>}
    <form onSubmit={(e) => { e.preventDefault(); if (pin.length >= 4 && !locked && !loading) onSubmit(pin); }} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3"><label htmlFor="authorization-pin" className="text-sm font-medium">PIN</label><div className="relative"><input id="authorization-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off" maxLength={6} disabled={locked || loading} autoFocus type="password" className="absolute inset-0 z-10 h-12 w-full cursor-text opacity-0" aria-label="PIN" /><div className="flex justify-center gap-3" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i} className={`flex size-10 items-center justify-center rounded-lg border-2 ${i < pin.length ? 'border-primary bg-primary/10' : 'border-border'}`}>{i < pin.length ? <span className="size-2.5 rounded-full bg-primary" /> : null}</span>)}</div></div>{locked ? <p className="text-center text-sm text-destructive">PIN locked. Try again in {time}</p> : error ? <p className="text-center text-sm text-destructive">{error}</p> : null}</div>
      <div className="flex items-center justify-between gap-3"><button type="button" className="text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={onForgot}>Forgot PIN?</button><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={pin.length < 4 || locked || loading}>{loading ? 'Verifying…' : 'Authorize'}</Button></div></div>
    </form>
  </DialogContent></Dialog>;
}

export default PinAuthorizeDialog;
