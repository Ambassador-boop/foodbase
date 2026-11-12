import { formatNaira } from '@/lib/finance'

/** Tabular money so columns line up in tables and cards. */
export function NGN(value: number | null | undefined) {
  return <span className="num whitespace-nowrap">{formatNaira(value)}</span>
}
