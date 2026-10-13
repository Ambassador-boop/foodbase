type PaystackBank = { code: string; name: string }

let cachedBanks: Map<string, string> | null = null
let cachedAt = 0
const CACHE_TTL = 12 * 60 * 60 * 1000

export async function getBankName(code: string | null | undefined): Promise<string> {
  const normalized = String(code || '')
  if (!normalized) return ''
  try {
    const banks = await getBanks()
    return banks.get(normalized) || normalized
  } catch {
    return normalized
  }
}

export async function getBanks(): Promise<Map<string, string>> {
  if (cachedBanks && Date.now() - cachedAt < CACHE_TTL) return cachedBanks
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return cachedBanks || new Map()
  const response = await fetch('https://api.paystack.co/bank?currency=NGN', {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Failed to fetch banks')
  const payload = await response.json()
  const next = new Map<string, string>((payload.data || []).map((bank: PaystackBank) => [String(bank.code), bank.name]))
  cachedBanks = next
  cachedAt = Date.now()
  return next
}

export function bankMapToArray(map: Map<string, string>) {
  return Array.from(map, ([code, name]) => ({ code, name }))
} 
