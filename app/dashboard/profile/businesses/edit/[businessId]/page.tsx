'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle } from 'lucide-react'

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
  is_active: boolean
}

export default function EditBusinessPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [business, setBusiness] = useState<Business | null>(null)
  const [formData, setFormData] = useState<Partial<Business>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    fetchBusiness()
  }, [businessId])

  const fetchBusiness = async () => {
    try {
      const response = await fetch(`/api/business/${businessId}`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch business')

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleLogoClick = () => {
    fileInputRef.current?.click()
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLogoUploading(true)
      const data = new FormData()
      data.append('file', file)

      const response = await fetch(`/api/business/${businessId}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: data,
      })

      if (!response.ok) throw new Error('Failed to upload logo')

      const result = await response.json()
      setFormData(prev => ({ ...prev, logo_url: result.logo_url }))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      console.error('Logo upload error:', err)
      setError('Failed to upload logo')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      const response = await fetch(`/api/business/${businessId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to update business')

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/profile/businesses')
      }, 1500)
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to save business details')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="space-y-4">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive/40 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground">Business not found</h2>
          <p className="text-muted-foreground text-sm mt-1">The business you're looking for doesn't exist</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-foreground">Edit Business</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm dark:bg-green-950 dark:border-green-800 dark:text-green-200">
            Business details updated successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo Section */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-card-foreground">Business Logo</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div
                className="relative w-24 h-24 sm:w-28 sm:h-28 bg-secondary/20 border-2 border-dashed border-primary/30 rounded-lg overflow-hidden cursor-pointer hover:border-primary/60 hover:bg-secondary/30 transition-all duration-300 flex-shrink-0"
                onClick={handleLogoClick}
              >
                {formData.logo_url ? (
                  <Image
                    src={formData.logo_url}
                    alt="Logo"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <button
                  type="button"
                  onClick={handleLogoClick}
                  disabled={logoUploading}
                  className="inline-flex items-center justify-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60 transition-opacity duration-200 gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {logoUploading ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="text-xs text-muted-foreground mt-2">JPG, PNG up to 5MB</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>

          {/* Basic Info */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-card-foreground">Basic Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  required
                  className="mt-1.5 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  required
                  className="mt-1.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
                className="mt-1.5 text-sm"
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleInputChange}
                rows={3}
                className="mt-1.5 text-sm"
              />
            </div>
          </div>

          {/* Address Info */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-card-foreground">Address Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  className="mt-1.5 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="city" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleInputChange}
                  className="mt-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <Label htmlFor="state" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</Label>
                <Input
                  id="state"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleInputChange}
                  className="mt-1.5 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="country" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Country</Label>
                <Input
                  id="country"
                  name="country"
                  value={formData.country || ''}
                  onChange={handleInputChange}
                  className="mt-1.5 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="postal_code" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  value={formData.postal_code || ''}
                  onChange={handleInputChange}
                  className="mt-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60 transition-opacity duration-200"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
