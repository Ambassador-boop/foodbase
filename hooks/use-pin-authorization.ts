'use client';
import { useState } from 'react';
import React from 'react';
import { PinAuthorizeDialog, type PinAction } from '@/components/security/pin-authorize-dialog';
import { PinSetupDialog } from '@/components/security/pin-setup-dialog';
import { apiErrorMessage, apiErrorCode, apiErrorDetails } from '@/lib/api/errors';
export function usePinAuthorization() {
  const [request, setRequest] = useState<any>(null); const [setup, setSetup] = useState<any>(null); const [error, setError] = useState(''); const [lockedUntil, setLockedUntil] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const authorize = (action: PinAction, params: Record<string, unknown>, summary?: string) => new Promise<string>((resolve, reject) => { setError(''); setLockedUntil(null); setRequest({ action, params, summary, resolve, reject }); });
  const submit = async (pin: string) => { if (!request) return; setLoading(true); setError(''); try { const r = await fetch('/api/security/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: request.action, params: request.params, pin }) }); const d = await r.json(); const code = apiErrorCode(d); const details = apiErrorDetails(d); if (r.status === 409 && code === 'PIN_NOT_SET') { setSetup({ mode: 'create', reopen: request }); setRequest(null); return; } if (r.status === 429 && code === 'LOCKED') { setLockedUntil(typeof details.lockedUntil === 'string' ? details.lockedUntil : null); return; } if (r.status === 401 && code === 'WRONG_PIN') { setError(`Incorrect PIN. ${String(details.attemptsLeft ?? 0)} attempt(s) left`); return; } if (!r.ok) throw new Error(apiErrorMessage(d, 'Authorization failed')); request.resolve(d.ticket); setRequest(null); } catch (e) { setError(e instanceof Error ? e.message : 'Authorization failed'); } finally { setLoading(false); } };
  const closeAuthorize = (open: boolean) => { if (!open && request) { request.reject(new Error('cancelled')); setRequest(null); } };
  const authorizeDialog = React.createElement(PinAuthorizeDialog, { open: !!request, action: request?.action || 'withdrawal', summary: request?.summary, lockedUntil, loading, error, onSubmit: submit, onForgot: () => { if (request) setSetup({ mode: 'reset', reopen: request }); setRequest(null); }, onOpenChange: closeAuthorize });
  const setupDialog = React.createElement(PinSetupDialog, { open: !!setup, mode: setup?.mode || 'create', onOpenChange: (open: boolean) => { if (!open) { if (setup?.reopen) setRequest(setup.reopen); setSetup(null); } }, onSuccess: () => { if (setup?.reopen) { setRequest(setup.reopen); setSetup(null); } } });
  return { authorize, dialogs: React.createElement(React.Fragment, null, authorizeDialog, setupDialog) };
}
