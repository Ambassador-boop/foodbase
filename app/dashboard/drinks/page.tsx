"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Wine,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  Eye,
  EyeOff,
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

type Drink = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  size?: string | null
  category?: string | null
  created_at: string
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export default function DrinksPage() {
  const [drinks, setDrinks] = useState<Drink[]>([])
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
      const res = await fetch("/api/business/drinks", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load drinks")
      const data = await res.json()
      setDrinks(Array.isArray(data) ? data : data.drinks || [])
    } catch (err) {
      console.error("[v0] drinks load error", err)
      toast({
        title: "Could not load drinks",
        description: "Please refresh the page.",
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
    return drinks.filter((d) => {
      const matchesSearch =
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.description ?? "").toLowerCase().includes(search.toLowerCase())
      const matchesFilter =
        filter === "all" ||
        (filter === "available" && d.is_available) ||
        (filter === "unavailable" && !d.is_available)
      return matchesSearch && matchesFilter
    })
  }, [drinks, search, filter])

  const stats = useMemo(() => {
    const total = drinks.length
    const available = drinks.filter((d) => d.is_available).length
    const avgPrice =
      drinks.length === 0
        ? 0
        : drinks.reduce((sum, d) => sum + Number(d.price || 0), 0) /
          drinks.length
    return { total, available, avgPrice }
  }, [drinks])

  async function toggleAvailability(drink: Drink) {
    try {
      const res = await fetch(`/api/business/drinks/${drink.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !drink.is_available }),
      })
      if (!res.ok) throw new Error("Failed")
      setDrinks((prev) =>
        prev.map((d) =>
          d.id === drink.id ? { ...d, is_available: !drink.is_available } : d,
        ),
      )
    } catch (err) {
      toast({
        title: "Could not update drink",
        variant: "destructive",
      })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/business/drinks/${deleteId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "Drink removed" })
      setDeleteId(null)
      load()
    } catch (err) {
      toast({
        title: "Could not delete drink",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Drinks
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Manage your beverage menu, pricing and availability.
          </p>
        </div>
        <Link href="/dashboard/drinks/new">
          <Button className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Add drink
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total drinks</p>
              <p className="text-xl font-semibold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
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
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg. price</p>
              <p className="text-xl font-semibold">
                {formatPrice(stats.avgPrice)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">All drinks</CardTitle>
              <CardDescription>
                {filtered.length} of {drinks.length} drinks
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search drinks..."
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
              <Wine className="mb-3 h-10 w-10 text-muted-foreground" />
              <EmptyTitle>No drinks yet</EmptyTitle>
              <EmptyDescription>
                {drinks.length === 0
                  ? "Add your first drink to start building your beverage menu."
                  : "Try adjusting your search or filters."}
              </EmptyDescription>
              {drinks.length === 0 && (
                <Link href="/dashboard/drinks/new" className="mt-4 inline-block">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add your first drink
                  </Button>
                </Link>
              )}
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((drink) => (
                <div
                  key={drink.id}
                  className="group relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {drink.image_url ? (
                      <img
                        src={drink.image_url || "/placeholder.svg"}
                        alt={drink.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Wine className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute right-2 top-2">
                      {drink.is_available ? (
                        <Badge className="border-0 bg-emerald-500/90 text-white shadow-sm">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Available
                        </Badge>
                      ) : (
                        <Badge className="border-0 bg-rose-500/90 text-white shadow-sm">
                          <XCircle className="mr-1 h-3 w-3" />
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="line-clamp-1 font-semibold">
                        {drink.name}
                      </h3>
                      {drink.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {drink.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        {formatPrice(drink.price)}
                      </span>
                      {drink.size ? (
                        <Badge variant="secondary" className="text-xs">
                          {drink.size}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
                      <Link
                        href={`/dashboard/drinks/edit/${drink.id}`}
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
                        onClick={() => toggleAvailability(drink)}
                        className="col-span-1 gap-1.5"
                      >
                        {drink.is_available ? (
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
                        onClick={() => setDeleteId(drink.id)}
                        className="col-span-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
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
            <AlertDialogTitle>Delete this drink?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The drink will be permanently
              removed from your menu.
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
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
