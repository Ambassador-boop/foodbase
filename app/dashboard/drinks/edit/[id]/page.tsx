'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DrinkForm from '@/components/drink-form';
import { AlertCircle } from 'lucide-react';

interface Drink {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
}

export default function EditDrinkPage() {
  const params = useParams();
  const id = params.id as string;
  const [drink, setDrink] = useState<Drink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDrink();
  }, [id]);

  const fetchDrink = async () => {
    try {
      const response = await fetch(`/api/business/drinks/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch drink');
      }

      setDrink(data.drink);
    } catch (err) {
      setError('Failed to load drink');
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

  if (error || !drink) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error || 'Drink not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Drink</h1>
        <p className="text-muted-foreground text-sm mt-1">Update this drink</p>
      </div>
      <DrinkForm drink={drink} isEditing={true} />
    </div>
  );
}
