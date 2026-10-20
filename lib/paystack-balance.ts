let cached: { value: number | null; expires: number } | null = null
export async function getPaystackBalance(): Promise<number | null> {
  if (cached && cached.expires > Date.now()) return cached.value
  try {
    const key = process.env.PAYSTACK_SECRET_KEY
    if (!key) return null
    const response = await fetch('https://api.paystack.co/balance', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' })
    if (!response.ok) throw new Error('Paystack balance request failed')
    const data = await response.json()
    const ngn = data?.data?.find((item: any) => item.currency === 'NGN')
    const value = ngn?.balance == null ? null : Number(ngn.balance) / 100
    cached = { value, expires: Date.now() + 60000 }
    return value
  } catch { cached = { value: null, expires: Date.now() + 60000 }; return null }
}
