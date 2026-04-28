"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Sparkles,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Tag,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { useToast } from "@/hooks/use-toast"

type PopularDish = {
  id: string
  combination_name: string
  description: string | null
  tagline: string | null
  featured_image_url: string | null
  price: number | null
  original_price: number | null
  discount_type: "none" | "percentage" | "amount" | null
  discount_value: number | null
  is_available: boolean
  display_order: number
  created_at: string
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return null
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function calcFinalPrice(d: PopularDish) {
  const base = Number(d.price ?? 0)
  if (!base) return null
  if (d.discount_type === "percentage" && d.discount_value) {
    return base - (base * Number(d.discount_value)) / 100
  }
  if (d.discount_type === "amount" && d.discount_value) {
    return Math.max(0, base - Number(d.discount_value))
  }
  return base
}

export default function PopularDishesPage() {
  const [dishes, setDishes] = useState<PopularDish[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "available" | "unavailable">(
    "all",
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/business/popular-dishes", {
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setDishes(data.popularDishes || [])
    } catch (err) {
      console.error("[v0] popular dishes load error", err)
      toast({
        title: "Could not load popular dishes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    function onSwitch() {
      load()
    }
    window.addEventListener("business-switched", onSwitch)
    return () => window.removeEventListener("business-switched", onSwitch)
  }, [])

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      const matchesSearch =
        !search ||
        d.combination_name.toLowerCase().includes(search.toLowerCase()) ||
        (d.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (d.tagline ?? "").toLowerCase().includes(search.toLowerCase())
      const matchesFilter =
        filter === "all" ||
        (filter === "available" && d.is_available) ||
        (filter === "unavailable" && !d.is_available)
      return matchesSearch && matchesFilter
    })
  }, [dishes, search, filter])

  const stats = useMemo(() => {
    const total = dishes.length
    const available = dishes.filter((d) => d.is_available).length
    const discounted = dishes.filter(
      (d) => d.discount_type && d.discount_type !== "none" && d.discount_value,
    ).length
    return { total, available, discounted }
  }, [dishes])

  async function toggleAvailability(dish: PopularDish) {
    try {
      const res = await fetch(`/api/business/popular-dishes/${dish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !dish.is_available }),
      })
      if (!res.ok) throw new Error("Failed")
      setDishes((prev) =>
        prev.map((d) =>
          d.id === dish.id ? { ...d, is_available: !dish.is_available } : d,
        ),
      )
    } catch {
      toast({ title: "Could not update dish", variant: "destructive" })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/business/popular-dishes/${deleteId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "Dish removed" })
      setDeleteId(null)
      load()
    } catch {
      toast({ title: "Could not delete dish", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Popular dishes
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Spotlight your best-sellers and signature combinations.
          </p>
        </div>
        <Link href="/dashboard/popular/new">
          <Button className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Feature a dish
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Featured</p>
              <p className="text-xl font-semibold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-xl font-semibold">{stats.available}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 border-border/60 sm:col-span-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">On discount</p>
              <p className="text-xl font-semibold">{stats.discounted}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Your featured dishes</CardTitle>
              <CardDescription>
                {filtered.length} of {dishes.length} dishes
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "available", "unavailable"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Empty className="py-12">
              <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
              <EmptyTitle>No featured dishes yet</EmptyTitle>
              <EmptyDescription>
                {dishes.length === 0
                  ? "Showcase your signature combos so customers can spot them at a glance."
                  : "Try adjusting your search or filters."}
              </EmptyDescription>
              {dishes.length === 0 && (
                <Link
                  href="/dashboard/popular/new"
                  className="mt-4 inline-block"
                >
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Feature your first dish
                  </Button>
                </Link>
              )}
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((dish) => {
                const finalPrice = calcFinalPrice(dish)
                const showOriginal =
                  dish.original_price && Number(dish.original_price) > 0
                const showDiscountedFromBase =
                  dish.discount_type &&
                  dish.discount_type !== "none" &&
                  dish.discount_value &&
                  finalPrice !== null &&
                  Number(dish.price) > finalPrice

                return (
                  <div
                    key={dish.id}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {dish.featured_image_url ? (
                        <img
                          src={dish.featured_image_url || "/placeholder.svg"}
                          alt={dish.combination_name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Sparkles className="h-10 w-10" />
                        </div>
                      )}

                      {dish.tagline ? (
                        <div className="absolute left-2 top-2">
                          <Badge className="border-0 bg-primary/90 text-primary-foreground shadow-sm">
                            {dish.tagline}
                          </Badge>
                        </div>
                      ) : null}

                      {dish.discount_type &&
                      dish.discount_type !== "none" &&
                      dish.discount_value ? (
                        <div className="absolute right-2 top-2">
                          <Badge className="border-0 bg-amber-500/90 text-white shadow-sm">
                            <Tag className="mr-1 h-3 w-3" />
                            {dish.discount_type === "percentage"
                              ? `${dish.discount_value}% off`
                              : `${formatPrice(dish.discount_value)} off`}
                          </Badge>
                        </div>
                      ) : null}

                      {!dish.is_available ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                          <Badge variant="secondary">Unavailable</Badge>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <h3 className="line-clamp-1 font-semibold">
                          {dish.combination_name}
                        </h3>
                        {dish.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {dish.description}
                          </p>
                        ) : null}
                      </div>

                      {finalPrice !== null ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-primary">
                            {formatPrice(finalPrice)}
                          </span>
                          {showDiscountedFromBase ? (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatPrice(dish.price)}
                            </span>
                          ) : showOriginal &&
                            Number(dish.original_price) > Number(dish.price) ? (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatPrice(dish.original_price)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No price set
                        </p>
                      )}

                      <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
                        <Link
                          href={`/dashboard/popular/edit/${dish.id}`}
                          className="col-span-1"
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAvailability(dish)}
                          className="col-span-1 gap-1.5"
                        >
                          {dish.is_available ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Show
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(dish.id)}
                          className="col-span-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from featured?</AlertDialogTitle>
            <AlertDialogDescription>
              This dish will no longer appear in your popular section. You can
              re-feature it anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
