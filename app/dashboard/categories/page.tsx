'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/business/categories');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setCategories(data.categories || []);
    } catch (err) {
      setError('Failed to load categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      const response = await fetch('/api/business/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add category');
        return;
      }

      setCategories([data.category, ...categories]);
      setFormData({ name: '', description: '' });
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Categories</h1>
          <p className="text-xs text-muted-foreground">Organize your menu into logical groups</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Category
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
            <h2 className="text-sm font-semibold">Add New Category</h2>
            <button onClick={() => setShowForm(false)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddCategory} className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Category Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Rice Dishes"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-semibold">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe this category..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 text-xs min-h-12"
              />
            </div>

            <Button type="submit" className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Add Category
            </Button>
          </form>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.length === 0 ? (
          <div className="col-span-full bg-white border border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">No categories yet. Create your first category!</p>
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="bg-white border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-1">{category.name}</h3>
              {category.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
              )}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Created {new Date(category.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
