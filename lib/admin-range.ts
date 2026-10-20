const WAT = 'Africa/Lagos'

export type AdminRange = { key: 'today' | '7d' | '30d' | 'month' | 'all'; from: Date | null; to: Date | null }

function parts(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: WAT, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).reduce<Record<string, string>>((a, p) => (a[p.type] = p.value, a), {})
}
function utcForWat(y: number, m: number, d: number) { return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 60 * 60 * 1000) }
export function parseRange(input?: string): AdminRange {
  const key = ['today', '7d', '30d', 'month', 'all'].includes(input || '') ? input as AdminRange['key'] : '30d'
  if (key === 'all') return { key, from: null, to: null }
  const now = new Date(), p = parts(now), y = Number(p.year), m = Number(p.month), d = Number(p.day)
  const to = utcForWat(y, m, d + 1)
  const from = key === 'today' ? utcForWat(y, m, d) : key === 'month' ? utcForWat(y, m, 1) : new Date(to.getTime() - (key === '7d' ? 7 : 30) * 86400000)
  return { key, from, to }
}
export const watDateSql = (column: string, timestamptz = false) => timestamptz ? `${column} AT TIME ZONE 'Africa/Lagos'` : `(${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos'`
