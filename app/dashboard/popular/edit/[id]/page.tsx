'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PopularDishForm from '@/components/popular-dish-form';
import { AlertCircle } from 'lucide-react';

interface PopularDish {
  id: string;
  combination_name: string;
  description?: string;
  featured_image_url?: string;
  display_order: number;
}

export default function EditPopularDishPage() {
  const params = useParams();
  const id = params.id as string;
  const [dish, setDish] = useState<PopularDish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDish();
  }, [id]);

  const fetchDish = async () => {
    try {
      const response = await fetch(`/api/business/popular-dishes/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch dish');
      }

      setDish(data.popularDish);
    } catch (err) {
      setError('Failed to load dish');
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

  if (error || !dish) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error || 'Dish not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Featured Dish</h1>
        <p className="text-muted-foreground text-sm mt-1">Update this featured dish</p>
      </div>
      <PopularDishForm dish={dish} isEditing={true} />
    </div>
  );
}
