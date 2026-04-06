'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle, Edit2, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Business {
  id: string
  name: string
  email: string
  phone: string
  description?: string
  is_active: boolean
}

export default function BusinessesPage() {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)

  useEffect(() => {
    fetchBusinesses()
  }, [])

  const fetchBusinesses = async () => {
    try {
      const response = await fetch('/api/user/businesses')
      if (!response.ok) throw new Error('Failed to fetch businesses')
      
      const data = await response.json()
      setBusinesses(data.businesses || [])
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchBusiness = async (businessId: string) => {
    try {
      setSelectedBusinessId(businessId)
      const response = await fetch('/api/user/switch-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId }),
      })

      if (!response.ok) throw new Error('Failed to switch business')
      
      // Redirect to dashboard after switching
      router.push('/dashboard/menu')
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to switch business')
    } finally {
      setSelectedBusinessId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="space-y-3">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Businesses</h1>
          <p className="text-gray-500 text-sm mt-1">View, switch, and manage your businesses</p>
        </div>
        <Link href="/dashboard/profile">
          <Button variant="outline" className="h-8 text-xs">
            Back to Profile
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {businesses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No businesses found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {businesses.map((business) => (
            <div
              key={business.id}
              className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{business.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{business.email}</p>
                  <p className="text-sm text-gray-600">{business.phone}</p>
                  {business.description && (
                    <p className="text-sm text-gray-500 mt-2">{business.description}</p>
                  )}
                  <div className="mt-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        business.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {business.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Link href={`/dashboard/profile/businesses/edit/${business.id}`}>
                    <Button variant="outline" className="h-8 text-xs">
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    onClick={() => handleSwitchBusiness(business.id)}
                    disabled={selectedBusinessId === business.id}
                    className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
                  >
                    {selectedBusinessId === business.id ? 'Switching...' : 'Switch'}
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
