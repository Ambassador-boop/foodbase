'use client';
import { useEffect, useState } from 'react';
import ChangePasswordSection from '@/components/security/change-password-section';
import PINManagementSection from '@/components/security/pin-management';
export default function SecurityPage() { const [hasPin, setHasPin] = useState(false); const [loading, setLoading] = useState(true); useEffect(() => { fetch('/api/security/pin/status', { credentials: 'include' }).then((r) => r.json()).then((d) => setHasPin(Boolean(d.hasPin))).finally(() => setLoading(false)); }, []); if (loading) return <div className="p-6 text-muted-foreground">Loading security settings...</div>; return <div className="mx-auto max-w-3xl"><div className="mb-8"><h1 className="text-3xl font-bold">Security Settings</h1><p className="text-muted-foreground">Manage your password and PIN authorization</p></div><div className="flex flex-col gap-6"><ChangePasswordSection /><PINManagementSection hasPinSet={hasPin} onPinStatusChange={setHasPin} /></div></div>; }
