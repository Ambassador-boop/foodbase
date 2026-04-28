"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { AlertCircle, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PopularDish {
  id?: string
  combination_name: string
  description?: string | null
  tagline?: string | null
  featured_image_url?: string | null
  price?: number | string | null
  original_price?: number | string | null
  discount_type?: "none" | "percentage" | "amount" | null
  discount_value?: number | string | null
  is_available?: boolean | null
}

interface PopularDishFormProps {
  dish?: PopularDish
  isEditing?: boolean
}

export default function PopularDishForm({
  dish,
  isEditing = false,
}: PopularDishFormProps) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    combinationName: dish?.combination_name || "",
    description: dish?.description || "",
    tagline: dish?.tagline || "",
    price: dish?.price != null ? String(dish.price) : "",
    originalPrice:
      dish?.original_price != null ? String(dish.original_price) : "",
    discountType: (dish?.discount_type as "none" | "percentage" | "amount") || "none",
    discountValue:
      dish?.discount_value != null ? String(dish.discount_value) : "",
    isAvailable: dish?.is_available ?? true,
    imageFile: null as File | null,
    imageUrl: dish?.featured_image_url || "",
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    dish?.featured_image_url || null,
  )

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true)
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      if (!cloudName) throw new Error("Cloudinary configuration missing")
      if (!file.type.startsWith("image/"))
        throw new Error("Please upload a valid image file")
      if (file.size > 10 * 1024 * 1024)
        throw new Error("File size must be less than 10MB")

      const fd = new FormData()
      fd.append("file", file)
      fd.append("upload_preset", "foodbase_upload")
      fd.append("folder", "foodbase/popular")

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: fd },
      )
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${errorText}`)
      }
      const data = await response.json()
      return data.secure_url
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      console.error("[v0] Upload error:", errorMsg)
      setError(`Failed to upload image: ${errorMsg}`)
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFormData((prev) => ({ ...prev, imageFile: file }))
    const reader = new FileReader()
    reader.onloadend = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageFile: null, imageUrl: "" }))
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.combinationName.trim()) {
      setError("Combination name is required")
      return
    }
    if (!isEditing && !formData.imageFile && !formData.imageUrl) {
      setError("Image is required for new dishes")
      return
    }

    setSubmitting(true)
    let imageUrl: string | null = formData.imageUrl || null

    if (formData.imageFile) {
      const uploaded = await uploadImage(formData.imageFile)
      if (!uploaded) {
        setSubmitting(false)
        return
      }
      imageUrl = uploaded
    }

    try {
      const endpoint = isEditing
        ? `/api/business/popular-dishes/${dish?.id}`
        : "/api/business/popular-dishes"
      const method = isEditing ? "PATCH" : "POST"

      const payload: any = {
        combinationName: formData.combinationName.trim(),
        description: formData.description.trim() || null,
        tagline: formData.tagline.trim() || null,
        featuredImageUrl: imageUrl,
        price: formData.price ? Number(formData.price) : null,
        originalPrice: formData.originalPrice
          ? Number(formData.originalPrice)
          : null,
        discountType: formData.discountType,
        discountValue:
          formData.discountType !== "none" && formData.discountValue
            ? Number(formData.discountValue)
            : null,
        isAvailable: formData.isAvailable,
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to save dish")
        return
      }
      router.push("/dashboard/popular")
      router.refresh()
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // Compute the effective price preview
  const computedFinalPrice = (() => {
    const base = Number(formData.price || 0)
    if (!base) return null
    if (formData.discountType === "percentage") {
      const v = Number(formData.discountValue || 0)
      return base - (base * v) / 100
    }
    if (formData.discountType === "amount") {
      const v = Number(formData.discountValue || 0)
      return Math.max(0, base - v)
    }
    return base
  })()

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            {isEditing ? "Edit featured dish" : "Add a popular dish"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Image */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Featured image</Label>
            {previewUrl ? (
              <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-border">
                <Image
                  src={previewUrl || "/placeholder.svg"}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute right-2 top-2 rounded-full bg-rose-500 p-1 text-white shadow hover:bg-rose-600"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-3 text-xs text-muted-foreground">
                  PNG, JPG up to 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose image
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Combination name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Jollof & Chicken Special"
                value={formData.combinationName}
                onChange={(e) =>
                  setFormData({ ...formData, combinationName: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tagline" className="text-sm font-medium">
                Tagline
              </Label>
              <Input
                id="tagline"
                placeholder="A short eye-catching line e.g. Most loved combo"
                value={formData.tagline}
                onChange={(e) =>
                  setFormData({ ...formData, tagline: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe this featured combo..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-24"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-sm font-medium">
                Price (NGN)
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="2500"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="original_price" className="text-sm font-medium">
                Original price (optional)
              </Label>
              <Input
                id="original_price"
                type="number"
                step="0.01"
                placeholder="3000"
                value={formData.originalPrice}
                onChange={(e) =>
                  setFormData({ ...formData, originalPrice: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Used to show a strikethrough on the customer site.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Discount type</Label>
              <Select
                value={formData.discountType}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    discountType: v as "none" | "percentage" | "amount",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No discount</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="amount">Fixed amount (NGN)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="discount_value" className="text-sm font-medium">
                Discount value
              </Label>
              <Input
                id="discount_value"
                type="number"
                step="0.01"
                disabled={formData.discountType === "none"}
                placeholder={
                  formData.discountType === "percentage" ? "10" : "500"
                }
                value={formData.discountValue}
                onChange={(e) =>
                  setFormData({ ...formData, discountValue: e.target.value })
                }
              />
            </div>

            {computedFinalPrice !== null ? (
              <div className="rounded-md border border-border/60 bg-muted/40 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Customers will see
                </p>
                <p className="text-lg font-semibold text-primary">
                  ₦{computedFinalPrice.toLocaleString()}
                  {formData.discountType !== "none" &&
                  Number(formData.price) > computedFinalPrice ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                      ₦{Number(formData.price).toLocaleString()}
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-md border border-border/60 p-3 sm:col-span-2">
              <div>
                <Label className="text-sm font-medium">Available</Label>
                <p className="text-xs text-muted-foreground">
                  Show this dish to customers right now.
                </p>
              </div>
              <Switch
                checked={formData.isAvailable}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isAvailable: checked })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="submit"
              disabled={submitting || uploadingImage}
              className="flex-1"
            >
              {submitting || uploadingImage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update dish"
              ) : (
                "Add featured dish"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
