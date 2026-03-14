'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        setFormData(data.user);
      } catch (err) {
        setError('Failed to load user');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      router.push('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading user...</p>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="flex items-center gap-2 text-primary text-sm hover:underline">
          <ChevronLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="flex items-center gap-2 text-primary text-sm hover:underline">
        <ChevronLeft className="w-4 h-4" />
        Back to Users
      </Link>

      <div>
        <h1 className="text-2xl font-bold mb-1">Edit User</h1>
        <p className="text-xs text-muted-foreground">Update user account information</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name" className="text-xs font-semibold">
                First Name *
              </Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="last_name" className="text-xs font-semibold">
                Last Name *
              </Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-xs font-semibold">
              Email Address *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs font-semibold">
              Phone Number (Optional)
            </Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role" className="text-xs font-semibold">
                Role *
              </Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="mt-1 w-full h-8 text-xs border border-border rounded px-2 bg-white"
              >
                <option value="admin">Admin</option>
                <option value="business_owner">Business Owner</option>
              </select>
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
