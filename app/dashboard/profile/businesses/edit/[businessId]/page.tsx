'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, ArrowLeft } from 'lucide-react'

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

  const [business, setBusiness] = useState<Business | null>(null)
  const [formData, setFormData] = useState<Partial<Business>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchBusiness()
  }, [businessId])

  const fetchBusiness = async () => {
    try {
      const response = await fetch(`/api/business/${businessId}`)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      const response = await fetch(`/api/business/${businessId}`, {
        method: 'PATCH',
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
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Business not found</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-primary hover:text-primary mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Business</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          Business details updated successfully! Redirecting...
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Business Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              required
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              required
              className="w-full"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone
          </Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone || ''}
            onChange={handleInputChange}
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description || ''}
            onChange={handleInputChange}
            rows={4}
            className="w-full"
          />
        </div>

        {/* Address Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </Label>
            <Input
              id="address"
              name="address"
              value={formData.address || ''}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
              City
            </Label>
            <Input
              id="city"
              name="city"
              value={formData.city || ''}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
              State
            </Label>
            <Input
              id="state"
              name="state"
              value={formData.state || ''}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
              Country
            </Label>
            <Input
              id="country"
              name="country"
              value={formData.country || ''}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-2">
              Postal Code
            </Label>
            <Input
              id="postal_code"
              name="postal_code"
              value={formData.postal_code || ''}
              onChange={handleInputChange}
              className="w-full"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <Button
            type="submit"
            disabled={saving}
            className="bg-primary text-white hover:bg-primary-dark"
          >
            {saving ? 'Saving...' : 'Save Changes'}
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
  )
}
