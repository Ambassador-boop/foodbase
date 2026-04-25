'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  profile_picture_url?: string
}

interface Business {
  id: string
  name: string
  email: string
  phone: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfileData()
  }, [])

  const fetchProfileData = async () => {
    try {
      const [userRes, businessRes] = await Promise.all([
        fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',
        }),
        fetch('/api/user/businesses', {
          method: 'GET',
          credentials: 'include',
        }),
      ])

      if (!userRes.ok) {
        throw new Error(`Failed to fetch user profile: ${userRes.status}`)
      }
      if (!businessRes.ok) {
        throw new Error(`Failed to fetch businesses: ${businessRes.status}`)
      }

      const userData = await userRes.json()
      const businessData = await businessRes.json()

      setUser(userData.user)
      setBusinesses(businessData.businesses || [])
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleProfilePictureClick = () => {
    fileInputRef.current?.click()
  }

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/user/profile/picture', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to upload profile picture')

      const data = await response.json()
      setUser(prev => prev ? { ...prev, profile_picture_url: data.picture_url } : null)
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to upload profile picture')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-muted rounded-lg w-48"></div>
            <div className="h-40 bg-muted rounded-xl"></div>
            <div className="h-40 bg-muted rounded-xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-40 bg-muted rounded-xl"></div>
              <div className="h-40 bg-muted rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-destructive/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-foreground mb-2">Failed to load profile</h2>
          <p className="text-muted-foreground">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-foreground">User Profile</h1>
          </div>
          <p className="text-muted-foreground text-xs">Manage your account settings and preferences</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Profile Picture Section */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 mb-4 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-lg font-semibold text-card-foreground">Profile Picture</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div
              className="relative w-24 h-24 sm:w-28 sm:h-28 bg-secondary/20 border-2 border-dashed border-primary/30 rounded-full overflow-hidden cursor-pointer hover:border-primary/60 hover:bg-secondary/30 transition-all duration-300 flex-shrink-0"
              onClick={handleProfilePictureClick}
            >
              {user.profile_picture_url ? (
                <Image
                  src={user.profile_picture_url}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1">
              <button
                onClick={handleProfilePictureClick}
                disabled={uploading}
                className="inline-flex items-center justify-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60 transition-opacity duration-200 gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploading ? 'Uploading...' : 'Upload Picture'}
              </button>
              <p className="text-xs text-muted-foreground mt-2">JPG, PNG up to 5MB</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleProfilePictureUpload}
            className="hidden"
          />
        </div>

        {/* User Details Section */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 mb-4 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-card-foreground">Personal Information</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border-l-2 border-primary/30 pl-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Name</Label>
              <p className="mt-1 text-sm font-medium text-card-foreground">{user.first_name}</p>
            </div>
            <div className="border-l-2 border-primary/30 pl-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Name</Label>
              <p className="mt-1 text-sm font-medium text-card-foreground">{user.last_name}</p>
            </div>
            <div className="border-l-2 border-primary/30 pl-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
              <p className="mt-1 text-sm font-medium text-card-foreground break-all">{user.email}</p>
            </div>
            <div className="border-l-2 border-primary/30 pl-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</Label>
              <p className="mt-1 text-sm font-medium text-card-foreground">{user.phone || 'Not provided'}</p>
            </div>
          </div>
        </div>

        {/* Businesses Section */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 mb-4 hover:shadow-md transition-shadow duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-card-foreground">Businesses</h2>
            </div>
            <Link href="/dashboard/profile/businesses">
              <button className="inline-flex items-center justify-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity duration-200 gap-2 text-xs">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Manage
              </button>
            </Link>
          </div>

          {businesses.length === 0 ? (
            <div className="text-center py-6 px-4">
              <svg className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-muted-foreground text-xs">No businesses associated with your account</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {businesses.map((business) => (
                <div key={business.id} className="p-3 border border-border rounded-lg hover:bg-secondary/10 transition-colors duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm text-card-foreground">{business.name}</h3>
                      <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                        <p>{business.email}</p>
                        <p>{business.phone}</p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-primary/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bank Details & Share Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bank Details */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-card-foreground">Bank Details</h2>
            </div>
            <p className="text-muted-foreground text-xs mb-4">Manage your bank account for withdrawals</p>
            <Link href="/dashboard/profile/bank-details">
              <button className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity duration-200 gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Manage
              </button>
            </Link>
          </div>

          {/* Share Business */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C9.589 12.938 10.54 12.5 11.5 12.5c4.418 0 8-1.79 8-4s-3.582-4-8-4-8 1.79-8 4c0 1.393.409 2.701 1.124 3.784m0-6C3.062 6.332 2 7.735 2 9.5 2 13.084 5.656 16 10 16h.348m6 1.272L21 12m0 0l-3-3m3 3l-3 3" />
              </svg>
              <h2 className="text-lg font-semibold text-card-foreground">Share Business</h2>
            </div>
            <p className="text-muted-foreground text-xs mb-4">Collaborate with team members</p>
            <Link href="/dashboard/share">
              <button className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity duration-200 gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Share
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
