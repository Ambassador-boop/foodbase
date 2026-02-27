'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, AlertCircle } from 'lucide-react';

interface Business {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  created_at: string;
  is_active: boolean;
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

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

  const handleAddBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }

    try {
      const response = await fetch('/api/admin/businesses/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to register business');
        return;
      }

      setBusinesses([data.business, ...businesses]);
      setFormData({ name: '', email: '', phone: '' });
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
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
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Register Business
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Register New Business</h2>
            <button onClick={() => setShowForm(false)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddBusiness} className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Business Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., ABC Restaurant"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-xs font-semibold">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="owner@restaurant.com"
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

            <Button type="submit" className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Register Business
            </Button>
          </form>
        </div>
      )}

      {/* Businesses Table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {businesses.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No businesses registered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Email</th>
                  <th className="px-3 py-2 text-left font-semibold">Slug</th>
                  <th className="px-3 py-2 text-center font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {businesses.map((business) => (
                  <tr key={business.id} className="hover:bg-muted/5">
                    <td className="px-3 py-2 font-medium">{business.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{business.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{business.slug}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          business.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {business.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(business.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
