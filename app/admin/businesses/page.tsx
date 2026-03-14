'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, AlertCircle, Edit2, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Business {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  logo_url?: string;
  created_at: string;
  is_active: boolean;
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await fetch('/api/admin/businesses');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setBusinesses(data.businesses || []);
    } catch (err) {
      setError('Failed to load businesses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteBusiness = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business?')) return;

    try {
      const response = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      setBusinesses(businesses.filter((b) => b.id !== businessId));
    } catch (err) {
      setError('Failed to delete business');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading businesses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Businesses</h1>
          <p className="text-xs text-muted-foreground">Manage restaurant accounts</p>
        </div>
        <Link href="/admin/businesses/register">
          <Button className="h-8 text-xs bg-primary text-white hover:bg-primary-dark">
            <Plus className="w-4 h-4 mr-1" />
            Register Business
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Businesses Grid */}
      {businesses.length === 0 ? (
        <div className="bg-white border border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">No businesses registered yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.map((business) => (
            <div key={business.id} className="bg-white border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              {/* Logo Section */}
              {business.logo_url && (
                <div className="h-32 bg-muted/5 overflow-hidden relative">
                  <Image
                    src={business.logo_url}
                    alt={business.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{business.name}</h3>
                  <p className="text-xs text-muted-foreground">{business.slug}</p>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>📧 {business.email}</p>
                  {business.phone && <p>📱 {business.phone}</p>}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        business.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {business.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(business.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Link href={`/admin/businesses/${business.id}`} className="flex-1">
                    <button className="w-full py-1.5 text-xs text-primary border border-primary rounded hover:bg-primary/5 transition-colors flex items-center justify-center gap-1">
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </Link>
                  <Link href={`/admin/businesses/edit/${business.id}`} className="flex-1">
                    <button className="w-full py-1.5 text-xs text-primary border border-primary rounded hover:bg-primary/5 transition-colors flex items-center justify-center gap-1">
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </Link>
                  <button
                    onClick={() => deleteBusiness(business.id)}
                    className="flex-1 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
