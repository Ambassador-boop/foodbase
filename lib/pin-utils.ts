import { getOne, query } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';
export function formatNigerianPhone(phone: string): string { const cleaned=phone.replace(/\D/g,''); return cleaned.startsWith('0')?'234'+cleaned.slice(1):cleaned.startsWith('234')?cleaned:'234'+cleaned; }
export async function hashPin(pin: string): Promise<string> { const bcrypt=await import('bcryptjs'); return bcrypt.hash(pin,10); }
export async function comparePin(pin: string, hash: string): Promise<boolean> { const bcrypt=await import('bcryptjs'); return bcrypt.compare(pin,hash); }
export async function updateKudiBalance(balance:number) { const existing=await getOne('SELECT * FROM kudi_sms_balance LIMIT 1'); if(existing) await query('UPDATE kudi_sms_balance SET balance=$1,last_updated=NOW() WHERE id=$2',[balance,existing.id]); else await query('INSERT INTO kudi_sms_balance (id,balance,last_updated,created_at) VALUES ($1,$2,NOW(),NOW())',[generateAlphanumericId(12),balance]); }
export async function getKudiBalance() { return getOne('SELECT balance,last_updated FROM kudi_sms_balance ORDER BY last_updated DESC LIMIT 1'); }
