import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Logo } from '@/components/brand/logo'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyAmount } from '@/components/ui/money-amount'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { PhoneInput } from '@/components/ui/phone-input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SectionHeading } from '@/components/ui/section-heading'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate, formatDateTime, formatNaira } from '@/lib/format'
import { ToastDemo } from './toast-demo'

/**
 * /design - the design system on one page.
 *
 * This route is a workshop, not a product screen. It is reachable in
 * development and in any deployment where DESIGN_PREVIEW=1, and it returns 404
 * everywhere else. It is also noindex, because a page of specimens should never
 * be the thing a customer finds in a search result.
 */

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The gate is checked per request, not at build time. A static build would bake
 * the answer in: the route would either be a permanent 404 or a permanently
 * published page depending on what the build machine had set. Reading
 * DESIGN_PREVIEW at request time is what the rule actually means.
 */
export const dynamic = 'force-dynamic'

const BRAND_RAMP = [
  { name: 'brand-50', hex: '#FDF5EA' },
  { name: 'brand-100', hex: '#FCECD4' },
  { name: 'brand-200', hex: '#F4D2A8' },
  { name: 'brand-300', hex: '#E7AD70' },
  { name: 'brand-400', hex: '#CF7F3D' },
  { name: 'brand-500', hex: '#B35A17' },
  { name: 'brand-600', hex: '#8C3800' },
  { name: 'brand-700', hex: '#6E2C00' },
  { name: 'brand-800', hex: '#4F2000' },
  { name: 'brand-900', hex: '#331500' },
]

const LIGHT_ROLES = [
  { name: 'paper', hex: '#FBF7F1', note: 'page background' },
  { name: 'surface', hex: '#FFFFFF', note: 'cards, sheets, inputs' },
  { name: 'line', hex: '#E7DFD4', note: 'hairline rules' },
  { name: 'line-strong', hex: '#948573', note: 'control borders' },
  { name: 'ink', hex: '#1F1611', note: 'text' },
  { name: 'ink-muted', hex: '#6B5E55', note: 'secondary text' },
]

const DARK_ROLES = [
  { name: 'paper', hex: '#14100D', note: 'page background' },
  { name: 'surface', hex: '#1C1612', note: 'cards, sheets, inputs' },
  { name: 'line', hex: '#342B24', note: 'hairline rules' },
  { name: 'line-strong', hex: '#7A6A5C', note: 'control borders' },
  { name: 'ink', hex: '#F3EAE0', note: 'text' },
  { name: 'ink-muted', hex: '#A89A8E', note: 'secondary text' },
]

const STATUS_PAIRS = [
  { name: 'success', fg: '#1F7A4D', bg: '#E6F3EC' },
  { name: 'warning', fg: '#9C5C00', bg: '#FBF0DD' },
  { name: 'danger', fg: '#B3261E', bg: '#FBE9E7' },
  { name: 'info', fg: '#2F5D7C', bg: '#E6EEF4' },
]

const TYPE_SCALE = [
  { cls: 'type-display', label: 'display', spec: '40/48 mobile · 56/60 desktop · Fraunces 600' },
  { cls: 'type-h1', label: 'h1', spec: '32/38 mobile · 40/46 desktop · Fraunces 600' },
  { cls: 'type-h2', label: 'h2', spec: '24/30 mobile · 28/34 desktop · Fraunces 600' },
  { cls: 'type-h3', label: 'h3', spec: '20/26 · Fraunces 600' },
  { cls: 'type-body', label: 'body', spec: '16/24 · Instrument Sans 400' },
  { cls: 'type-small', label: 'small', spec: '14/20 · Instrument Sans 400' },
  { cls: 'type-caption', label: 'caption', spec: '12/16 · Instrument Sans 500' },
]

const ORDERS = [
  { id: 'FB-1042', customer: 'Chidera Okafor', items: 3, total: '18400.00', status: 'preparing', at: '2026-11-26T11:05:00Z' },
  { id: 'FB-1041', customer: 'Amaka Eze', items: 1, total: '5200.00', status: 'pending', at: '2026-11-26T10:58:00Z' },
  { id: 'FB-1040', customer: 'Tunde Bakare', items: 5, total: '31750.50', status: 'ready', at: '2026-11-26T10:44:00Z' },
  { id: 'FB-1039', customer: 'Ngozi Nwosu', items: 2, total: '9600.00', status: 'completed', at: '2026-11-26T10:31:00Z' },
  { id: 'FB-1038', customer: 'Ibrahim Musa', items: 4, total: '22300.00', status: 'confirmed', at: '2026-11-26T10:22:00Z' },
  { id: 'FB-1037', customer: 'Blessing Adeniyi', items: 1, total: '3500.00', status: 'cancelled', at: '2026-11-26T10:14:00Z' },
  { id: 'FB-1036', customer: 'Emeka Obi', items: 6, total: '44180.00', status: 'completed', at: '2026-11-26T10:02:00Z' },
  { id: 'FB-1035', customer: 'Fatima Bello', items: 2, total: '11400.00', status: 'preparing', at: '2026-11-26T09:51:00Z' },
  { id: 'FB-1034', customer: 'Segun Adeleke', items: 3, total: '16750.00', status: 'ready', at: '2026-11-26T09:44:00Z' },
  { id: 'FB-1033', customer: 'Halima Yusuf', items: 1, total: '4800.00', status: 'completed', at: '2026-11-26T09:30:00Z' },
  { id: 'FB-1032', customer: 'Oluwaseun Ajayi', items: 8, total: '58900.00', status: 'confirmed', at: '2026-11-26T09:18:00Z' },
  { id: 'FB-1031', customer: 'Chiamaka Uche', items: 2, total: '8900.00', status: 'pending', at: '2026-11-26T09:06:00Z' },
  { id: 'FB-1030', customer: 'Yusuf Danjuma', items: 4, total: '26300.00', status: 'completed', at: '2026-11-26T08:57:00Z' },
  { id: 'FB-1029', customer: 'Adaeze Mba', items: 3, total: '15100.00', status: 'preparing', at: '2026-11-26T08:45:00Z' },
  { id: 'FB-1028', customer: 'Kelechi Nnamdi', items: 1, total: '6200.00', status: 'cancelled', at: '2026-11-26T08:33:00Z' },
  { id: 'FB-1027', customer: 'Zainab Aliyu', items: 5, total: '33400.00', status: 'completed', at: '2026-11-26T08:21:00Z' },
  { id: 'FB-1026', customer: 'Femi Ogunleye', items: 2, total: '10200.00', status: 'ready', at: '2026-11-26T08:12:00Z' },
  { id: 'FB-1025', customer: 'Rukayat Salami', items: 3, total: '17800.00', status: 'confirmed', at: '2026-11-26T08:04:00Z' },
  { id: 'FB-1024', customer: 'Ikenna Uzo', items: 7, total: '47550.00', status: 'completed', at: '2026-11-26T07:55:00Z' },
  { id: 'FB-1023', customer: 'Aisha Garba', items: 1, total: '4100.00', status: 'pending', at: '2026-11-26T07:41:00Z' },
]

const NAIRA_CASES = ['0', '1000', '1234567.89', '-1200']

/** A labelled block: every specimen on the page is framed the same way. */
function Specimen({
  title,
  description,
  children,
  className = '',
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col gap-4 border-t border-line pt-6 ${className}`}>
      <div className="flex flex-col gap-1">
        <h3 className="type-h3 text-ink">{title}</h3>
        {description ? <p className="max-w-[70ch] type-small text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** One state of a control, with the state named underneath it. */
function StateCell({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-13 items-center">{children}</div>
      <span className="type-caption text-ink-muted">{state}</span>
    </div>
  )
}

const FOCUS_STYLE = { outline: '2px solid var(--focus-ring)', outlineOffset: '2px' } as const

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  if (process.env.NODE_ENV === 'production' && process.env.DESIGN_PREVIEW !== '1') {
    notFound()
  }

  // ?theme=dark puts the whole page in the dark theme, which is how the
  // screenshots for a review are taken without a browser extension.
  const { theme } = await searchParams
  const dark = theme === 'dark'

  return (
    <main
      {...(dark ? { 'data-theme': 'dark' } : {})}
      className="min-h-screen bg-paper pb-24 text-ink"
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
        {/* ---------------------------------------------------------- header */}
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo variant="lockup" size={30} tone={dark ? 'on-dark' : 'brown'} />
            <div className="flex items-center gap-2">
              <Badge variant="brand">Internal · not indexed</Badge>
              <Button variant="outline" size="sm" asChild>
                <a href={dark ? '/design' : '/design?theme=dark'}>
                  {dark ? 'Light theme' : 'Dark theme'}
                </a>
              </Button>
            </div>
          </div>
          <PageHeader
            title="Design system"
            description="Every token, every type step and every component in one place, in both themes. This page is the reference for the rebuild: if a screen needs something that is not here, it goes here first."
            breadcrumb={
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">FoodBase</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Design system</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            }
            meta={
              <>
                <Badge variant="secondary">Fraunces + Instrument Sans</Badge>
                <Badge variant="secondary">4 px spacing</Badge>
                <Badge variant="secondary">Two radii</Badge>
                <Badge variant="secondary">WCAG 2.2 AA</Badge>
              </>
            }
          />
        </header>

        {/* ---------------------------------------------------------- tokens */}
        <section className="flex flex-col gap-6">
          <SectionHeading
            title="Colour"
            description="The brown and the cream carry the identity. The ramp is fixed; the roles below it change with the theme."
          />

          <div className="flex flex-col gap-3">
            <h3 className="type-h3 text-ink">Brand ramp</h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {BRAND_RAMP.map((token) => (
                <li key={token.name} className="flex flex-col gap-2">
                  <span
                    className="h-16 w-full rounded-[var(--radius-control)] border border-line"
                    style={{ backgroundColor: token.hex }}
                  />
                  <span className="flex flex-col">
                    <span className="type-small font-medium text-ink">{token.name}</span>
                    <span className="type-caption tnum text-ink-muted">{token.hex}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { label: 'Light theme roles', roles: LIGHT_ROLES },
              { label: 'Dark theme roles', roles: DARK_ROLES },
            ].map((group) => (
              <div key={group.label} className="flex flex-col gap-3">
                <h3 className="type-h3 text-ink">{group.label}</h3>
                <ul className="flex flex-col gap-2">
                  {group.roles.map((role) => (
                    <li key={role.name} className="flex items-center gap-3">
                      <span
                        className="size-9 shrink-0 rounded-[var(--radius-control)] border border-line"
                        style={{ backgroundColor: role.hex }}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="type-small font-medium text-ink">{role.name}</span>
                        <span className="type-caption text-ink-muted">
                          {role.note} · <span className="tnum">{role.hex}</span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="type-h3 text-ink">Status pairs</h3>
            <p className="max-w-[70ch] type-small text-ink-muted">
              Each state is a colour and a word, never a colour on its own. The word is set on the
              soft fill, which is the pair the contrast check measures.
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STATUS_PAIRS.map((pair) => (
                <li
                  key={pair.name}
                  className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line p-3"
                  style={{ backgroundColor: pair.bg }}
                >
                  <span className="type-small font-medium" style={{ color: pair.fg }}>
                    {pair.name}
                  </span>
                  <span className="type-caption tnum" style={{ color: pair.fg }}>
                    {pair.fg} on {pair.bg}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ type */}
        <section className="flex flex-col gap-6">
          <SectionHeading
            title="Type"
            description="One display face and one interface face. Every step is defined once and steps up at 768 px."
          />

          <div className="flex flex-col divide-y divide-line">
            {TYPE_SCALE.map((step) => (
              <div key={step.cls} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <div className="w-40 shrink-0">
                  <span className="type-caption font-medium text-ink">{step.label}</span>
                  <span className="block type-caption text-ink-muted">{step.spec}</span>
                </div>
                <p className={`${step.cls} min-w-0 text-ink`}>Jollof rice, fried plantain</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <h3 className="type-h3 text-ink">Naira test line</h3>
            <p className="max-w-[70ch] type-small text-ink-muted">
              The sign is U+20A6, which lives in the latin-ext subset. If the glyph is missing the
              price shows a box, so this line is checked in both faces at every review.
            </p>
            <div className="flex flex-col gap-2">
              <p className="type-small text-ink-muted">Instrument Sans (interface)</p>
              <p className="type-h3 tnum text-ink">
                {NAIRA_CASES.map((value) => formatNaira(value)).join('   ·   ')}
              </p>
              <p className="type-small text-ink-muted">Fraunces (display)</p>
              <p className="type-h3 tnum text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                {NAIRA_CASES.map((value) => formatNaira(value)).join('   ·   ')}
              </p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- shape & motion */}
        <section className="flex flex-col gap-6">
          <SectionHeading
            title="Spacing, radii, elevation and motion"
            description="One spacing scale on a 4 px base, two radii, one raised shadow, three durations and no bounce."
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="type-h3 text-ink">Spacing</h3>
              <ul className="flex flex-col gap-2">
                {[4, 8, 12, 16, 24, 32, 48].map((step) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 type-caption tnum text-ink-muted">{step}px</span>
                    <span className="h-2 rounded-[2px] bg-brand-300" style={{ width: step }} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="type-h3 text-ink">Radii</h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="size-16 rounded-[var(--radius-control)] border border-line-strong bg-surface" />
                    <span className="type-caption text-ink-muted">8 px · controls</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="size-16 rounded-[var(--radius-card)] border border-line-strong bg-surface" />
                    <span className="type-caption text-ink-muted">14 px · cards, sheets</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="type-h3 text-ink">Elevation</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="size-16 rounded-[var(--radius-card)] border border-line bg-surface" />
                    <span className="type-caption text-ink-muted">flat + hairline</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="size-16 rounded-[var(--radius-card)] border border-line bg-surface raised" />
                    <span className="type-caption text-ink-muted">raised</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="type-h3 text-ink">Motion</h3>
                <p className="type-small text-ink-muted">
                  120 ms for state, 200 ms for a surface appearing, 300 ms for a panel moving.
                  cubic-bezier(0.2, 0.8, 0.2, 1). All of it stops under prefers-reduced-motion.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ components */}
        <section className="flex flex-col gap-8">
          <SectionHeading
            title="Components"
            description="Restyled shadcn primitives plus the FoodBase-specific ones. Props are unchanged, so every existing screen still compiles."
          />

          <Specimen
            title="Button"
            description="Four variants and three heights: 36, 44 and 52 px. Focus is the system ring: 2 px brand at a 2 px offset."
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-3">
                <span className="type-caption font-medium text-ink-muted">Primary</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm">Save</Button>
                  <Button>Save</Button>
                  <Button size="lg">Save</Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="type-caption font-medium text-ink-muted">Secondary</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm">Duplicate</Button>
                  <Button variant="secondary">Duplicate</Button>
                  <Button variant="secondary" size="lg">Duplicate</Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="type-caption font-medium text-ink-muted">Ghost</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm">Cancel</Button>
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="ghost" size="lg">Cancel</Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="type-caption font-medium text-ink-muted">Destructive</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="destructive" size="sm">Delete</Button>
                  <Button variant="destructive">Delete</Button>
                  <Button variant="destructive" size="lg">Delete</Button>
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StateCell state="Default">
                <Button>Accept</Button>
              </StateCell>
              <StateCell state="Hover">
                <Button className="bg-brand-700">Accept</Button>
              </StateCell>
              <StateCell state="Focus">
                <Button style={FOCUS_STYLE}>Accept</Button>
              </StateCell>
              <StateCell state="Disabled">
                <Button disabled>Accept</Button>
              </StateCell>
              <StateCell state="Loading">
                <Button loading>Accept</Button>
              </StateCell>
              <StateCell state="Error">
                <Button variant="destructive">Retry</Button>
              </StateCell>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="type-caption font-medium text-ink-muted">Outline and link</span>
              <Button variant="outline" size="sm">Outline</Button>
              <Button variant="link">Read the policy</Button>
              <Button size="icon" aria-label="Add item">
                <span aria-hidden className="type-body leading-none">+</span>
              </Button>
            </div>
          </Specimen>

          <Specimen
            title="Form controls"
            description="Inputs are 44 px high with a 3:1 border and 16 px text on mobile, so the page never zooms on focus."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <FormField label="Restaurant name" hint="This is what customers see." required>
                  <Input placeholder="Mama Nkechi Kitchen" />
                </FormField>
                <FormField label="Kitchen note" hint="Printed on the ticket.">
                  <Textarea placeholder="No pepper on the second plate" />
                </FormField>
                <FormField
                  label="Phone number"
                  hint="Used for delivery updates only."
                  error="Enter the 10 digits after the country code."
                >
                  <PhoneInput defaultValue="08031234567" invalid />
                </FormField>
              </div>

              <div className="flex flex-col gap-4">
                <FormField label="Cuisine" htmlFor="spec-cuisine">
                  <Select defaultValue="nigerian">
                    <SelectTrigger id="spec-cuisine">
                      <SelectValue placeholder="Choose a cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nigerian">Nigerian</SelectItem>
                      <SelectItem value="continental">Continental</SelectItem>
                      <SelectItem value="fastfood">Fast food</SelectItem>
                      <SelectItem value="grill">Grill and suya</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="flex flex-col gap-2">
                  <span className="type-caption font-medium text-ink-muted">Input states</span>
                  <div className="grid gap-2">
                    <Input placeholder="Default" />
                    <Input placeholder="Focus" style={FOCUS_STYLE} />
                    <Input placeholder="Disabled" disabled />
                    <Input placeholder="Error" aria-invalid defaultValue="not-an-email" />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="spec-check" defaultChecked />
                    <Label htmlFor="spec-check">Send an SMS when an order is ready</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="spec-check-2" />
                    <Label htmlFor="spec-check-2">Send an SMS when an order is placed</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="spec-switch" defaultChecked />
                    <Label htmlFor="spec-switch">Accept orders now</Label>
                  </div>
                </div>

                <RadioGroup defaultValue="pickup" aria-label="Fulfilment">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="delivery" id="spec-radio-1" />
                    <Label htmlFor="spec-radio-1">Delivery</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="pickup" id="spec-radio-2" />
                    <Label htmlFor="spec-radio-2">Pickup</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </Specimen>

          <Specimen
            title="Badges, status and money"
            description="An amount is always ink. Direction is a minus sign and a label, never red or green text."
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="settled">Settled</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <span className="type-caption font-medium text-ink-muted">Order</span>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].map((s) => (
                    <StatusBadge key={s} kind="order" status={s} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="type-caption font-medium text-ink-muted">Settlement</span>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'available', 'paid out'].map((s) => (
                    <StatusBadge key={s} kind="settlement" status={s} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="type-caption font-medium text-ink-muted">Refund</span>
                <div className="flex flex-wrap gap-2">
                  {['requested', 'approved', 'refunded', 'rejected', 'failed'].map((s) => (
                    <StatusBadge key={s} kind="refund" status={s} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
              {NAIRA_CASES.map((value) => (
                <span key={value} className="flex flex-col gap-0.5">
                  <MoneyAmount value={value} size="h3" />
                  <span className="type-caption text-ink-muted">
                    <span className="tnum">{value}</span> stored
                  </span>
                </span>
              ))}
            </div>
          </Specimen>

          <Specimen
            title="Page header, section heading and stats"
            description="The hierarchy every screen uses: one h1, then h2 sections, then h3 blocks."
          >
            <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <PageHeader
                as="h2"
                title="Today"
                description="Orders, money and the kitchen, for Thursday 26 November."
                breadcrumb={
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Today</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                }
                actions={
                  <>
                    <Button variant="outline" size="sm">Export</Button>
                    <Button size="sm">New order</Button>
                  </>
                }
              />

              <SectionHeading
                title="Takings"
                description="Settled and pending, as of 4:30 pm."
                action={<Button variant="ghost" size="sm">See ledger</Button>}
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Orders" value="42" change="+12" direction="up" changeLabel="vs yesterday" />
                <Stat label="Takings" value={<MoneyAmount value="486300" size="h3" />} change="+₦41,200" direction="up" changeLabel="vs yesterday" />
                <Stat label="Average order" value={<MoneyAmount value="11578.57" size="h3" />} change="−₦320" direction="down" changeLabel="vs yesterday" />
                <Stat label="Refunds" value={<MoneyAmount value="-1200" size="h3" />} change="0" direction="flat" changeLabel="no change" />
              </div>
            </div>
          </Specimen>

          <Specimen
            title="Table"
            description="Comfortable for reading, dense for finance. Sticky header, numeric columns right-aligned in tabular figures."
          >
            <div className="flex flex-col gap-4">
              <Table>
                <TableCaption>Twenty orders, comfortable density.</TableCaption>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead numeric>Items</TableHead>
                    <TableHead numeric>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Placed</TableHead>
                    <TableHead>
                      <span className="sr-only">Copy</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ORDERS.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono type-caption">{order.id}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell numeric>{order.items}</TableCell>
                      <TableCell numeric>
                        <MoneyAmount value={order.total} size="small" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="order" status={order.status} />
                      </TableCell>
                      <TableCell className="text-ink-muted">{formatDateTime(order.at)}</TableCell>
                      <TableCell>
                        <CopyButton value={order.id} label={`Copy ${order.id}`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Table density="dense">
                <TableCaption>Dense density, the same five rows.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead numeric>Total</TableHead>
                    <TableHead>Placed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ORDERS.slice(0, 5).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono type-caption">{order.id}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell numeric>
                        <MoneyAmount value={order.total} size="small" />
                      </TableCell>
                      <TableCell className="text-ink-muted">{formatDate(order.at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#design" />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#design" isActive>
                      1
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#design">2</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#design">3</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#design" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </Specimen>

          <Specimen
            title="Empty, loading and error"
            description="A sentence and one action. No illustration, no icon wall, no apology."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <EmptyState
                title="No orders yet today."
                description="Orders appear here the moment a customer checks out."
                action={<Button size="sm">Share your menu</Button>}
              />

              <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card px-5 py-6">
                <span className="type-caption font-medium text-ink-muted">Loading</span>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-11 w-32" />
              </div>

              <ErrorState
                title="We could not load today’s orders."
                description="The connection dropped. Your orders are safe; this is only the list."
                reference="req_8f21c"
                retryHref="#design"
              />
            </div>
          </Specimen>

          <Specimen
            title="Overlays"
            description="A dialog on a tablet and up, a bottom sheet on a phone. Both use the one raised shadow and no blur."
          >
            <div className="flex flex-wrap items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel order FB-1042?</DialogTitle>
                    <DialogDescription>
                      The customer is refunded in full and the kitchen is told immediately.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost">Keep order</Button>
                    <Button variant="destructive">Cancel order</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">Open sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Order FB-1042</SheetTitle>
                    <SheetDescription>Three items, ready for the kitchen.</SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-col gap-2 px-5">
                    <p className="type-small text-ink">Jollof rice with chicken · ₦8,400.00</p>
                    <p className="type-small text-ink">Fried plantain · ₦2,000.00</p>
                    <p className="type-small text-ink">Chapman · ₦3,000.00</p>
                  </div>
                </SheetContent>
              </Sheet>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">Open menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Order</DropdownMenuLabel>
                  <DropdownMenuItem>Print ticket</DropdownMenuItem>
                  <DropdownMenuItem>Call customer</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">Cancel order</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm">Hover for a tooltip</Button>
                  </TooltipTrigger>
                  <TooltipContent>Settlement runs at 6 pm on weekdays.</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <CopyButton value="FB-1042" variant="outline" size="sm">
                Copy order number
              </CopyButton>
            </div>

            <Tabs defaultValue="open" className="mt-2">
              <TabsList>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="ready">Ready</TabsTrigger>
                <TabsTrigger value="done">Completed</TabsTrigger>
              </TabsList>
              <TabsContent value="open" className="type-small text-ink">
                Nine orders are being prepared.
              </TabsContent>
              <TabsContent value="ready" className="type-small text-ink">
                Two orders are waiting for a rider.
              </TabsContent>
              <TabsContent value="done" className="type-small text-ink">
                Thirty-one orders completed today.
              </TabsContent>
            </Tabs>

            <div className="mt-2 flex flex-col gap-3">
              <span className="type-caption font-medium text-ink-muted">Toasts</span>
              <ToastDemo />
            </div>
          </Specimen>

          <Specimen
            title="Avatar and logo"
            description="The mark alone below 160 px of width; the lockup above it. Never recoloured, never rotated, never on a busy photo."
          >
            <div className="flex flex-wrap items-end gap-8">
              <div className="flex flex-col items-center gap-2">
                <Logo variant="mark" size={48} tone="brown" />
                <span className="type-caption text-ink-muted">mark 48</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Logo variant="mark" size={32} tone="brown" />
                <span className="type-caption text-ink-muted">mark 32</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Logo variant="lockup" size={28} tone="ink" />
                <span className="type-caption text-ink-muted">lockup ink</span>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-brand-900 px-4 py-3">
                <Logo variant="lockup" size={24} tone="on-dark" />
                <span className="type-caption text-brand-100">lockup on dark</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 type-caption font-medium text-brand-800">
                  CO
                </span>
                <span className="flex size-11 items-center justify-center rounded-full bg-brand-100 type-small font-medium text-brand-800">
                  AE
                </span>
                <span className="type-caption text-ink-muted">avatar fallback</span>
              </div>
            </div>
          </Specimen>
        </section>

        {/* --------------------------------------------------------- themes */}
        <section className="flex flex-col gap-6">
          <SectionHeading
            title="Light and dark, side by side"
            description="The same markup in both themes. Only the token values change: no component is forked for dark, and no page needs an override."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {(['light', 'dark'] as const).map((theme) => (
              <div
                key={theme}
                {...(theme === 'dark' ? { 'data-theme': 'dark' } : {})}
                className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-paper p-4 text-ink"
              >
                <div className="flex items-center justify-between">
                  <span className="type-small font-medium text-ink">
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                  <Badge variant="secondary">{theme}</Badge>
                </div>

                <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-3">
                  <span className="type-caption font-medium text-ink-muted uppercase">Order FB-1042</span>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-small text-ink">Jollof rice with chicken</span>
                    <MoneyAmount value="8400" size="small" />
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-small text-ink">Delivery</span>
                    <MoneyAmount value="1200" size="small" />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                    <span className="type-small font-medium text-ink">Total</span>
                    <MoneyAmount value="9600" size="small" weight="semibold" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <StatusBadge kind="order" status="preparing" />
                    <StatusBadge kind="settlement" status="available" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm">Accept</Button>
                  <Button size="sm" variant="secondary">Duplicate</Button>
                  <Button size="sm" variant="outline">Export</Button>
                  <Button size="sm" variant="ghost">Dismiss</Button>
                </div>

                <div className="flex flex-col gap-2">
                  <Input placeholder="Search orders" />
                  <div className="flex items-center gap-2">
                    <Checkbox id={`theme-check-${theme}`} defaultChecked />
                    <Label htmlFor={`theme-check-${theme}`}>Notify the customer</Label>
                  </div>
                </div>

                <p className="type-caption text-ink-muted">
                  Links and accents use{' '}
                  <a href="#design" className="text-link underline underline-offset-4">
                    brand-300 in dark
                  </a>{' '}
                  and brand-600 in light.
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------------- footer */}
        <footer className="flex flex-col gap-3 border-t border-line pt-6">
          <Logo variant="lockup" size={22} tone="ink" />
          <p className="max-w-[70ch] type-small text-ink-muted">
            The gate for this page is <span className="font-mono">DESIGN_PREVIEW=1</span>; without it
            the route returns 404 in production. Contrast is enforced by{' '}
            <span className="font-mono">pnpm check:contrast</span>, which fails the build rather than
            trusting the eye.
          </p>
        </footer>
      </div>
    </main>
  )
}
