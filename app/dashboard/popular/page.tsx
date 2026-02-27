'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, AlertCircle } from 'lucide-react';

export default function PopularDishesPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    combinationName: '',
    imageUrl: '',
  });
  const [popularDishes, setPopularDishes] = useState([]);
  const [error, setError] = useState('');

  const handleAddPopularDish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.combinationName) {
      setError('Combination name is required');
      return;
    }

    try {
      // API call would go here
      alert('Popular dish added');
      setFormData({ combinationName: '', imageUrl: '' });
      setShowForm(false);
    } catch (err) {
      setError('Failed to add popular dish');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Popular Dishes</h1>
          <p className="text-xs text-muted-foreground">Featured combinations and best sellers</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Featured
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
            <h2 className="text-sm font-semibold">Add Popular Combination</h2>
            <button onClick={() => setShowForm(false)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddPopularDish} className="space-y-3">
            <div>
              <label className="text-xs font-semibold block mb-1">Combination Name</label>
              <Input
                placeholder="e.g., Jollof & Chicken Special"
                value={formData.combinationName}
                onChange={(e) => setFormData({ ...formData, combinationName: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Featured Image URL</label>
              <Input
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <Button type="submit" className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Add Featured Dish
            </Button>
          </form>
        </div>
      )}

      {/* Popular Dishes List */}
      <div className="bg-white border border-border rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Dishes automatically become popular after 10+ orders
        </p>
        <p className="text-xs text-muted-foreground">
          You can also manually feature custom combinations
        </p>
      </div>
    </div>
  );
}
