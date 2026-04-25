'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Business {
  id: string
  name: string
  email: string
  phone: string
  description?: string
  logo_url?: string
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="space-y-3">
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Businesses</h1>
            <p className="text-muted-foreground text-xs mt-1">View, switch, and manage your businesses</p>
          </div>
          <Link href="/dashboard/profile">
            <button className="inline-flex items-center justify-center px-3 py-1.5 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors duration-200">
              Back
            </button>
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {businesses.length === 0 ? (
          <div className="bg-card border border-border rounded-xl shadow-sm p-8 text-center">
            <p className="text-muted-foreground text-sm">No businesses found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {businesses.map((business) => (
              <div
                key={business.id}
                className="bg-card border border-border rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {/* Logo */}
                  {business.logo_url && (
                    <div className="relative w-20 h-20 flex-shrink-0 bg-secondary/20 rounded-lg overflow-hidden border border-border">
                      <Image
                        src={business.logo_url}
                        alt={business.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}

                  {/* Business Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-card-foreground truncate">{business.name}</h3>
                    <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                      <p className="truncate">{business.email}</p>
                      <p className="truncate">{business.phone}</p>
                    </div>
                    {business.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{business.description}</p>
                    )}
                    <div className="mt-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          business.is_active
                            ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {business.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Link href={`/dashboard/profile/businesses/edit/${business.id}`} className="flex-1 sm:flex-none">
                      <button className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium text-xs hover:opacity-90 transition-opacity duration-200">
                        <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    </Link>
                    <Link href={`/dashboard/menu/customize?businessId=${business.id}`} className="flex-1 sm:flex-none">
                      <button className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-muted text-foreground rounded-lg font-medium text-xs hover:bg-muted/80 transition-colors duration-200">
                        <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.5a2 2 0 00-1 3.75A4 4 0 0010 21z" />
                        </svg>
                        Menu
                      </button>
                    </Link>
                    <button
                      onClick={() => handleSwitchBusiness(business.id)}
                      disabled={selectedBusinessId === business.id}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium text-xs hover:opacity-90 disabled:opacity-60 transition-opacity duration-200"
                    >
                      {selectedBusinessId === business.id ? 'Switching...' : 'Switch'}
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
