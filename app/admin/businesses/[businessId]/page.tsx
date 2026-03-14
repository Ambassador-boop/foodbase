'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, ChevronLeft, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Business {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  description?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_orders?: number;
  available_balance?: number;
  pending_balance?: number;
}

export default function BusinessDetailPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.businessId as string;
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const response = await fetch(`/api/admin/businesses/${businessId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        setBusiness(data.business);
      } catch (err) {
        setError('Failed to load business');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [businessId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      router.push('/admin/businesses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete business');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading business details...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="space-y-4">
        <Link href="/admin/businesses" className="flex items-center gap-2 text-primary text-sm hover:underline">
          <ChevronLeft className="w-4 h-4" />
          Back to Businesses
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">Business not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/businesses" className="flex items-center gap-2 text-primary text-sm hover:underline">
        <ChevronLeft className="w-4 h-4" />
        Back to Businesses
      </Link>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            {/* Header Section */}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{business.name}</h1>
                  <p className="text-sm text-muted-foreground">{business.slug}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    business.is_active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  {business.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {business.logo_url && (
                <div className="relative w-32 h-32 bg-muted rounded overflow-hidden">
                  <Image
                    src={business.logo_url}
                    alt={business.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {business.description && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">Description</h3>
                  <p className="text-sm text-muted-foreground">{business.description}</p>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="px-6 py-4 border-t border-border">
              <h2 className="text-sm font-semibold mb-3">Contact Information</h2>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Email:</span> {business.email}
                </p>
                {business.phone && (
                  <p>
                    <span className="text-muted-foreground">Phone:</span> {business.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Address Information */}
            {(business.address || business.city || business.state) && (
              <div className="px-6 py-4 border-t border-border">
                <h2 className="text-sm font-semibold mb-3">Address</h2>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {business.address && <p>{business.address}</p>}
                  {(business.city || business.state || business.country) && (
                    <p>
                      {[business.city, business.state, business.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {business.postal_code && <p>{business.postal_code}</p>}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="px-6 py-4 border-t border-border">
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Created</p>
                  <p>{new Date(business.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Updated</p>
                  <p>{new Date(business.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Statistics Card */}
          {(business.total_orders !== undefined || business.available_balance !== undefined) && (
            <div className="bg-white border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Statistics</h3>
              <div className="space-y-2 text-sm">
                {business.total_orders !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Orders</span>
                    <span className="font-semibold">{business.total_orders}</span>
                  </div>
                )}
                {business.available_balance !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Available Balance</span>
                    <span className="font-semibold">
                      ₦{Number(business.available_balance || 0).toLocaleString()}
                    </span>
                  </div>
                )}
                {business.pending_balance !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pending Balance</span>
                    <span className="font-semibold">
                      ₦{Number(business.pending_balance || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white border border-border rounded-lg p-4 space-y-2">
            <Link href={`/admin/businesses/edit/${businessId}`} className="block">
              <Button className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark flex items-center justify-center gap-2">
                <Edit2 className="w-4 h-4" />
                Edit Business
              </Button>
            </Link>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
              className="w-full h-8 text-xs flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete Business'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
