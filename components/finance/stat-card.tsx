import { Card } from '@/components/ui/card'

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: React.ReactNode
  icon: React.ElementType
  hint?: string
}) {
  return (
    <Card className="min-w-0 gap-1 p-2.5 sm:gap-2 sm:p-4">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="min-w-0 text-[12px] leading-4 text-muted-foreground">{label}</p>
      <p className="min-w-0 whitespace-nowrap text-[15px] font-semibold sm:text-xl">{value}</p>
      {hint && <p className="hidden text-[11px] text-muted-foreground sm:block">{hint}</p>}
    </Card>
  )
}
