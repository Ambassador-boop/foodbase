'use client';
import { useEffect, useState } from 'react';
import { PinSetupDialog } from '@/components/security/pin-setup-dialog';
import { Button } from '@/components/ui/button';

export default function AdminSecurityPage() {
  const [hasPin, setHasPin] = useState(false); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false);
  useEffect(() => { fetch('/api/security/pin/status', { credentials: 'include' }).then((r) => r.json()).then((d) => setHasPin(Boolean(d.hasPin))).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="p-6 text-muted-foreground">Loading security settings...</div>;
  return <section className="mx-auto flex max-w-2xl flex-col gap-6"><div><h1 className="text-2xl font-bold">Security</h1><p className="text-muted-foreground">Manage your admin PIN authorization.</p></div><div className="rounded-lg border bg-card p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Admin PIN</h2><p className="text-sm text-muted-foreground">{hasPin ? 'A PIN is configured for sensitive admin actions.' : 'Create a PIN to authorize sensitive admin actions.'}</p></div><Button onClick={() => setOpen(true)}>{hasPin ? 'Change PIN' : 'Create PIN'}</Button></div></div><PinSetupDialog open={open} mode={hasPin ? 'reset' : 'create'} onOpenChange={setOpen} onSuccess={() => { setHasPin(true); setOpen(false); }} /></section>;
}
