'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewUserPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'admin',
    password_hash: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.first_name || !formData.last_name || !formData.email) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      router.push('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="flex items-center gap-2 text-primary text-sm hover:underline">
        <ChevronLeft className="w-4 h-4" />
        Back to Users
      </Link>

      <div>
        <h1 className="text-2xl font-bold mb-1">Create New User</h1>
        <p className="text-xs text-muted-foreground">Add a new admin or business owner account</p>
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
                placeholder="John"
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
                placeholder="Doe"
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
              placeholder="user@example.com"
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
              placeholder="+234 80000000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1 h-8 text-xs"
            />
          </div>

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

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-8 text-xs bg-primary text-white hover:bg-primary-dark"
            >
              {loading ? 'Creating...' : 'Create User'}
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
