'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AddonForm from '@/components/addon-form';
import { AlertCircle } from 'lucide-react';

interface Addon {
  id: string;
  name: string;
  addon_type: string;
  description?: string;
  price?: number;
  image_url?: string;
  is_required: boolean;
  allow_multiple: boolean;
  options?: Array<{ id: string; name: string; price: number }>;
}

export default function EditAddonPage() {
  const params = useParams();
  const id = params.id as string;
  const [addon, setAddon] = useState<Addon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAddon();
  }, [id]);

  const fetchAddon = async () => {
    try {
      const response = await fetch(`/api/business/addons/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch add-on');
      }

      setAddon(data.addon);
    } catch (err) {
      setError('Failed to load add-on');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !addon) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error || 'Add-on not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Add-on</h1>
        <p className="text-muted-foreground text-sm mt-1">Update this add-on group</p>
      </div>
      <AddonForm addon={addon} isEditing={true} />
    </div>
  );
}
