'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronLeft, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { uploadImage } from '@/lib/cloudinary';

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
}

export default function EditBusinessPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.businessId as string;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<Business | null>(null);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const response = await fetch(`/api/admin/businesses/${businessId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        setFormData(data.business);
        if (data.business.logo_url) {
          setLogoPreview(data.business.logo_url);
        }
      } catch (err) {
        setError('Failed to load business');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [businessId]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setError('');
    setSaving(true);

    try {
      let logoUrl = formData.logo_url;

      // Upload logo if new file selected
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, 'business_logos', `business_${businessId}`);
      }

      const response = await fetch(`/api/admin/businesses/${businessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          logo_url: logoUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update business');
      }

      router.push(`/admin/businesses/${businessId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading business...</p>
      </div>
    );
  }

  if (!formData) {
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
      <Link href={`/admin/businesses/${businessId}`} className="flex items-center gap-2 text-primary text-sm hover:underline">
        <ChevronLeft className="w-4 h-4" />
        Back to Business
      </Link>

      <div>
        <h1 className="text-2xl font-bold mb-1">Edit Business</h1>
        <p className="text-xs text-muted-foreground">Update business information</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo Upload */}
          <div>
            <Label className="text-xs font-semibold">Business Logo</Label>
            <div className="mt-2 flex gap-4">
              <div className="flex-shrink-0">
                {logoPreview ? (
                  <div className="relative w-20 h-20 bg-muted rounded overflow-hidden">
                    <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                    {logoFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(formData.logo_url || '');
                        }}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-muted rounded flex items-center justify-center text-muted-foreground">
                    <Upload className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  id="logo-input"
                />
                <label
                  htmlFor="logo-input"
                  className="inline-block px-3 py-1.5 text-xs border border-border rounded cursor-pointer hover:bg-muted/5 transition-colors"
                >
                  Choose Image
                </label>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Business Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-xs font-semibold">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs font-semibold">
              Phone Number
            </Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-xs font-semibold">
              Description
            </Label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 w-full min-h-20 text-xs border border-border rounded px-2 py-1"
            />
          </div>

          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold text-foreground">Address Information</h3>

            <div>
              <Label htmlFor="address" className="text-xs font-semibold">
                Street Address
              </Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="text-xs font-semibold">
                  City
                </Label>
                <Input
                  id="city"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="state" className="text-xs font-semibold">
                  State
                </Label>
                <Input
                  id="state"
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country" className="text-xs font-semibold">
                  Country
                </Label>
                <Input
                  id="country"
                  value={formData.country || ''}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="postal_code" className="text-xs font-semibold">
                  Postal Code
                </Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code || ''}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="is_active" className="text-xs font-semibold">
              Status *
            </Label>
            <select
              id="is_active"
              value={formData.is_active ? 'active' : 'inactive'}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
              className="mt-1 w-full h-8 text-xs border border-border rounded px-2 bg-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 h-8 text-xs bg-primary text-white hover:bg-primary-dark"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
