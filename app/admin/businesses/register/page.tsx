'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronLeft, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { uploadImage } from '@/lib/cloudinary';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function RegisterBusinessPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    owner_id: '',
    name: '',
    email: '',
    phone: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        if (response.ok) {
          // Filter for business owners or all users
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, []);

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
    setError('');
    setLoading(true);

    if (!formData.owner_id || !formData.name || !formData.email) {
      setError('Please select owner and fill required fields');
      setLoading(false);
      return;
    }

    try {
      let logoUrl = '';

      // Upload logo if provided
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, 'business_logos', `business_${Date.now()}`);
      }

      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const response = await fetch('/api/admin/businesses/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          logo_url: logoUrl,
          slug,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register business');
      }

      router.push('/admin/businesses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/admin/businesses" className="flex items-center gap-2 text-primary text-sm hover:underline">
        <ChevronLeft className="w-4 h-4" />
        Back to Businesses
      </Link>

      <div>
        <h1 className="text-2xl font-bold mb-1">Register New Business</h1>
        <p className="text-xs text-muted-foreground">Create a new restaurant account</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Owner Selection */}
          <div>
            <Label htmlFor="owner_id" className="text-xs font-semibold">
              Business Owner * {usersLoading && <span className="text-muted-foreground">(loading...)</span>}
            </Label>
            <select
              id="owner_id"
              value={formData.owner_id}
              onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
              className="mt-1 w-full h-8 text-xs border border-border rounded px-2 bg-white"
              disabled={usersLoading}
            >
              <option value="">Select owner...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Logo Upload */}
          <div>
            <Label className="text-xs font-semibold">Business Logo</Label>
            <div className="mt-2 flex gap-4">
              <div className="flex-shrink-0">
                {logoPreview ? (
                  <div className="relative w-20 h-20 bg-muted rounded overflow-hidden">
                    <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview('');
                      }}
                      className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
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
                placeholder="ABC Restaurant"
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
                placeholder="business@example.com"
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
              placeholder="+234 80000000"
              value={formData.phone}
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
              placeholder="Brief description of the business..."
              value={formData.description}
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
                placeholder="123 Main Street"
                value={formData.address}
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
                  placeholder="Lagos"
                  value={formData.city}
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
                  placeholder="Lagos"
                  value={formData.state}
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
                  placeholder="Nigeria"
                  value={formData.country}
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
                  placeholder="100001"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={loading || usersLoading}
              className="flex-1 h-8 text-xs bg-primary text-white hover:bg-primary-dark"
            >
              {loading ? 'Registering...' : 'Register Business'}
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
