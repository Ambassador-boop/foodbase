'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ImageIcon,
  Info,
  MapPin,
  Loader2,
  ImagePlus,
  Camera,
} from 'lucide-react'

interface Business {
  id: string
  name: string
  email: string
  phone: string
  description?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  logo_url?: string
  cover_image_url?: string
  is_active: boolean
}

export default function EditBusinessPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params?.businessId as string | undefined

  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [business, setBusiness] = useState<Business | null>(null)
  const [formData, setFormData] = useState<Partial<Business>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)

  useEffect(() => {
    if (!businessId) return
    fetchBusiness()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  const fetchBusiness = async () => {
    try {
      setError('')
      const response = await fetch(`/api/business/${businessId}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Failed to fetch business (${response.status})`)
      }
      const data = await response.json()
      setBusiness(data.business)
      setFormData(data.business)
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to load business details')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const uploadFile = async (
    file: File,
    endpoint: string,
    fieldKey: 'logo_url' | 'cover_image_url',
    setUploading: (b: boolean) => void
  ) => {
    try {
      setError('')
      setUploading(true)
      const data = new FormData()
      data.append('file', file)

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: data,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => null)
        throw new Error(errBody?.error || 'Upload failed')
      }

      const result = await response.json()
      const newUrl = result[fieldKey]
      setFormData((prev) => ({ ...prev, [fieldKey]: newUrl }))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 1800)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err?.message || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(
      file,
      `/api/business/${businessId}/logo`,
      'logo_url',
      setLogoUploading
    )
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(
      file,
      `/api/business/${businessId}/cover-image`,
      'cover_image_url',
      setCoverUploading
    )
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError('')
      setSaving(true)
      const response = await fetch(`/api/business/${businessId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const errBody = await response.json().catch(() => null)
        throw new Error(errBody?.error || 'Failed to update business')
      }
      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/profile/businesses')
      }, 1200)
    } catch (err: any) {
      console.error('Error:', err)
      setError(err?.message || 'Failed to save business details')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-40 bg-muted rounded-xl" />
            <div className="h-72 bg-muted rounded-xl" />
            <div className="h-72 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-destructive/40 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground">
            Business not found
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            We couldn&apos;t load this business. It may have been removed, or
            you may not have access to it.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/dashboard/profile/businesses')}
          >
            Back to businesses
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 pb-28 lg:pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 sm:mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
              Edit Business
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Update branding, contact, and location details
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-3"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-4 p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-start gap-3 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Saved successfully</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Cover image + logo card */}
          <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {/* Cover image area */}
            <div className="relative w-full aspect-[16/6] sm:aspect-[16/5] bg-secondary/30">
              {formData.cover_image_url ? (
                <Image
                  src={formData.cover_image_url}
                  alt="Cover image"
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 px-4 text-center">
                  <ImageIcon className="w-7 h-7" />
                  <p className="text-xs sm:text-sm">
                    No cover image yet — upload one to make your business stand
                    out
                  </p>
                </div>
              )}

              {/* Cover upload button overlay */}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-background/90 backdrop-blur border border-border shadow-sm hover:bg-background disabled:opacity-60"
              >
                {coverUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                {coverUploading
                  ? 'Uploading…'
                  : formData.cover_image_url
                    ? 'Change cover'
                    : 'Add cover'}
              </button>

              {/* Logo positioned over cover, like a profile header */}
              <div className="absolute -bottom-10 sm:-bottom-12 left-4 sm:left-6">
                <div className="relative">
                  <div
                    className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-card border-4 border-card shadow-md cursor-pointer"
                    onClick={() => logoInputRef.current?.click()}
                    role="button"
                    aria-label="Change logo"
                  >
                    {formData.logo_url ? (
                      <Image
                        src={formData.logo_url}
                        alt="Business logo"
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                        <Camera className="w-7 h-7 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    aria-label="Upload logo"
                    className="absolute -bottom-1 -right-1 inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-60"
                  >
                    {logoUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>

            {/* Spacer + helper text below cover (room for floating logo) */}
            <div className="pt-12 sm:pt-14 px-4 sm:px-6 pb-4 sm:pb-5">
              <h2 className="text-base sm:text-lg font-semibold text-card-foreground">
                {formData.name || 'Your business'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Tap the logo or cover to upload a new image. JPG or PNG, up to
                5MB (logo) or 8MB (cover).
              </p>
            </div>
          </section>

          {/* Basic Info */}
          <section className="bg-card border border-border rounded-2xl shadow-sm p-4 sm:p-6">
            <header className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-primary" />
              <h2 className="text-base sm:text-lg font-semibold text-card-foreground">
                Basic Information
              </h2>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-xs font-medium">
                  Business Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  required
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone" className="text-xs font-medium">
                  Phone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  value={formData.phone || ''}
                  onChange={handleInputChange}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="description" className="text-xs font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleInputChange}
                rows={3}
                placeholder="Tell customers what makes your business special"
                className="mt-1.5"
              />
            </div>
          </section>

          {/* Address Info */}
          <section className="bg-card border border-border rounded-2xl shadow-sm p-4 sm:p-6">
            <header className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-base sm:text-lg font-semibold text-card-foreground">
                Address Information
              </h2>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address" className="text-xs font-medium">
                  Street Address
                </Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="city" className="text-xs font-medium">
                  City
                </Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleInputChange}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <Label htmlFor="state" className="text-xs font-medium">
                  State
                </Label>
                <Input
                  id="state"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleInputChange}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="country" className="text-xs font-medium">
                  Country
                </Label>
                <Input
                  id="country"
                  name="country"
                  value={formData.country || ''}
                  onChange={handleInputChange}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="postal_code" className="text-xs font-medium">
                  Postal Code
                </Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  value={formData.postal_code || ''}
                  onChange={handleInputChange}
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>

          {/* Desktop actions */}
          <div className="hidden lg:flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="min-w-[160px]">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur p-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            // Submit the parent form programmatically
            const form = document.querySelector('form')
            if (form) form.requestSubmit()
          }}
          disabled={saving}
          className="flex-1"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
