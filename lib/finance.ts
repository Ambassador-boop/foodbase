export function formatNaira(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  const hasKobo = Math.abs(amount % 1) > Number.EPSILON
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}
