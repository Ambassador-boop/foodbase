'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Upload } from 'lucide-react'

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
      // Get auth token from localStorage
      const token = localStorage.getItem('authToken')
      if (!token) {
        throw new Error('No auth token found')
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }

      const [userRes, businessRes] = await Promise.all([
        fetch('/api/user/profile', { headers }),
        fetch('/api/user/businesses', { headers }),
      ])

      if (!userRes.ok) {
        console.error('[v0] User profile response:', userRes.status, await userRes.text())
        throw new Error('Failed to fetch user profile')
      }
      if (!businessRes.ok) {
        console.error('[v0] Businesses response:', businessRes.status, await businessRes.text())
        throw new Error('Failed to fetch businesses')
      }

      const userData = await userRes.json()
      const businessData = await businessRes.json()

      setUser(userData.user)
      setBusinesses(businessData.businesses || [])
    } catch (err) {
      console.error('[v0] Error:', err)
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
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-8"></div>
          <div className="space-y-4">
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">Failed to load profile</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Picture Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h2>
        
        <div className="flex items-center gap-6">
          <div
            className="relative w-24 h-24 bg-gray-200 rounded-full overflow-hidden cursor-pointer hover:bg-gray-300 transition-colors"
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
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          <div>
            <Button
              onClick={handleProfilePictureClick}
              disabled={uploading}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Picture'}
            </Button>
            <p className="text-xs text-gray-500 mt-2">JPG, PNG up to 5MB</p>
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
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">First Name</Label>
            <p className="mt-1 text-gray-900">{user.first_name}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Last Name</Label>
            <p className="mt-1 text-gray-900">{user.last_name}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Email</Label>
            <p className="mt-1 text-gray-900">{user.email}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Phone</Label>
            <p className="mt-1 text-gray-900">{user.phone || 'Not provided'}</p>
          </div>
        </div>
      </div>

      {/* Businesses Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Associated Businesses</h2>
          <Link href="/dashboard/profile/businesses">
            <Button className="h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Manage Businesses
            </Button>
          </Link>
        </div>

        {businesses.length === 0 ? (
          <p className="text-gray-500 text-sm">No businesses associated with this account.</p>
        ) : (
          <div className="space-y-3">
            {businesses.map((business) => (
              <div key={business.id} className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-medium text-gray-900">{business.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{business.email}</p>
                <p className="text-sm text-gray-500">{business.phone}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Business Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Share Business</h2>
        <p className="text-gray-600 text-sm mb-4">Share your business with team members or partners</p>
        <Link href="/dashboard/share">
          <Button className="bg-primary text-white hover:bg-primary-dark">
            Share Business
          </Button>
        </Link>
      </div>
    </div>
  )
}
