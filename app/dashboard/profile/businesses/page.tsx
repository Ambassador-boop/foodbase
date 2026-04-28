"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  AlertCircle,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  UtensilsCrossed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { switchBusiness } from "@/lib/business-switch"
import { useToast } from "@/hooks/use-toast"

interface Business {
  id: string
  name: string
  email: string
  phone: string
  slug: string
  description?: string
  logo_url?: string | null
  cover_image_url?: string | null
  address?: string | null
  is_active?: boolean
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [allRes, activeRes] = await Promise.all([
          fetch("/api/user/businesses", { credentials: "include" }),
          fetch("/api/business", { credentials: "include" }),
        ])
        const allData = await allRes.json()
        const activeData = await activeRes.json()
        if (cancelled) return
        setBusinesses(allData.businesses || [])
        setActiveId(activeData?.business?.id || null)
      } catch (err) {
        console.error("[v0] businesses load error", err)
        setError("Failed to load businesses")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSwitch(target: Business) {
    if (target.id === activeId) {
      toast({ title: "Already managing this business" })
      return
    }
    const current = businesses.find((b) => b.id === activeId) || null
    setSwitchingId(target.id)
    try {
      await switchBusiness(current, target)
      // switchBusiness handles redirect; if it doesn't, fall back:
      setActiveId(target.id)
    } catch (err) {
      console.error("[v0] switch failed", err)
      toast({ title: "Could not switch business", variant: "destructive" })
    } finally {
      setSwitchingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Your businesses
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            View, switch and manage every business under your account.
          </p>
        </div>
        <Link href="/dashboard/profile">
          <Button variant="outline" size="sm">
            Back to profile
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {businesses.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-10">
            <Empty>
              <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
              <EmptyTitle>No businesses yet</EmptyTitle>
              <EmptyDescription>
                Once you create a business it will appear here.
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => {
            const isActive = business.id === activeId
            return (
              <Card
                key={business.id}
                className={`group overflow-hidden border transition-all ${
                  isActive
                    ? "border-primary/50 ring-2 ring-primary/20"
                    : "border-border/60 hover:border-primary/40 hover:shadow-md"
                }`}
              >
                <div className="relative h-24 overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-amber-500/10">
                  {business.cover_image_url ? (
                    <Image
                      src={business.cover_image_url || "/placeholder.svg"}
                      alt=""
                      fill
                      className="object-cover opacity-70"
                      unoptimized
                    />
                  ) : null}
                  {isActive ? (
                    <Badge className="absolute right-3 top-3 border-0 bg-emerald-500/95 text-white shadow-sm">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                  ) : null}
                </div>

                <CardContent className="-mt-8 space-y-4 p-4">
                  <div className="flex items-end gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-4 border-background bg-card shadow-sm ring-1 ring-border">
                      {business.logo_url ? (
                        <Image
                          src={business.logo_url || "/placeholder.svg"}
                          alt={business.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-bold text-primary">
                          {business.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <h3 className="truncate text-base font-semibold">
                        {business.name}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {business.slug}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {business.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{business.email}</span>
                      </div>
                    ) : null}
                    {business.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{business.phone}</span>
                      </div>
                    ) : null}
                  </div>

                  {business.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {business.description}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                    <Link
                      href={`/dashboard/profile/businesses/edit/${business.id}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/menu/customize?businessId=${business.id}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                      >
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        Menu
                      </Button>
                    </Link>
                  </div>

                  <Button
                    onClick={() => handleSwitch(business)}
                    disabled={switchingId === business.id || isActive}
                    className="w-full gap-2"
                    variant={isActive ? "secondary" : "default"}
                  >
                    {switchingId === business.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Switching...
                      </>
                    ) : isActive ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Currently managing
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="h-4 w-4" />
                        Switch to this business
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
