'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, AlertCircle, Edit2, Eye, EyeOff, Search, Upload, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface PopularDish {
  id: string;
  combination_name: string;
  featured_image_url?: string;
  description?: string;
  is_available?: boolean;
  display_order: number;
}

export default function PopularDishesPage() {
  const [dishes, setDishes] = useState<PopularDish[]>([]);
  const [filteredDishes, setFilteredDishes] = useState<PopularDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    combinationName: '',
    description: '',
    imageFile: null as File | null,
    imageUrl: '',
  });

  useEffect(() => {
    fetchDishes();
  }, []);

  useEffect(() => {
    const filtered = dishes.filter(dish =>
      dish.combination_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredDishes(filtered);
  }, [searchTerm, dishes]);

  const fetchDishes = async () => {
    try {
      const response = await fetch('/api/business/popular-dishes');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setDishes(data.popularDishes || []);
      setFilteredDishes(data.popularDishes || []);
    } catch (err) {
      setError('Failed to load popular dishes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);
      formDataObj.append('upload_preset', 'foodbase_upload');
      formDataObj.append('folder', 'foodbase/popular');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formDataObj,
        }
      );

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      return data.secure_url;
    } catch (err) {
      console.error('[v0] Upload error:', err);
      setError('Failed to upload image');
      return null;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, imageFile: file });
    }
  };

  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.combinationName) {
      setError('Combination name is required');
      return;
    }

    if (!editingId && !formData.imageFile) {
      setError('Image is required for new dishes');
      return;
    }

    setUploading(true);
    let imageUrl = formData.imageUrl;

    // Upload image if selected
    if (formData.imageFile) {
      imageUrl = await uploadImageToCloudinary(formData.imageFile);
      if (!imageUrl) {
        setUploading(false);
        return;
      }
    }

    try {
      const endpoint = editingId
        ? `/api/business/popular-dishes/${editingId}`
        : '/api/business/popular-dishes';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combinationName: formData.combinationName,
          description: formData.description,
          featuredImageUrl: imageUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save dish');
        setUploading(false);
        return;
      }

      if (editingId) {
        setDishes(dishes.map(item => item.id === editingId ? data.popularDish : item));
      } else {
        setDishes([data.popularDish, ...dishes]);
      }

      setFormData({ combinationName: '', description: '', imageFile: null, imageUrl: '' });
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDish = async (dishId: string) => {
    if (!window.confirm('Are you sure you want to delete this dish?')) {
      return;
    }

    try {
      setDeletingId(dishId);
      const response = await fetch(`/api/business/popular-dishes/${dishId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete dish');
        return;
      }

      setDishes(dishes.filter(item => item.id !== dishId));
    } catch (err) {
      console.error('Error deleting dish:', err);
      setError('Failed to delete dish');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditDish = (dish: PopularDish) => {
    setFormData({
      combinationName: dish.combination_name,
      description: dish.description || '',
      imageFile: null,
      imageUrl: dish.featured_image_url || '',
    });
    setEditingId(dish.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading popular dishes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Popular Dishes</h1>
          <p className="text-xs text-muted-foreground">Featured combinations and best sellers</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setFormData({ combinationName: '', description: '', imageFile: null, imageUrl: '' });
            setShowForm(!showForm);
          }}
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
            <h2 className="text-sm font-semibold">{editingId ? 'Edit Featured Dish' : 'Add Popular Combination'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddDish} className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Featured Image</Label>
              <div className="mt-2 space-y-2">
                {formData.imageUrl ? (
                  <div className="relative w-20 h-20 rounded border border-border overflow-hidden">
                    <Image src={formData.imageUrl} alt="Preview" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageFile: null, imageUrl: '' })}
                      className="absolute top-0 right-0 bg-red-500 text-white p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="popular-image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Upload Image
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Combination Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Jollof & Chicken Special"
                value={formData.combinationName}
                onChange={(e) => setFormData({ ...formData, combinationName: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-semibold">
                Description
              </Label>
              <Input
                id="description"
                placeholder="Describe this featured combo..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <Button type="submit" disabled={uploading} className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              {uploading ? 'Uploading...' : editingId ? 'Update Dish' : 'Add Featured Dish'}
            </Button>
          </form>
        </div>
      )}

      {/* Search Bar */}
      {dishes.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search popular dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      )}

      {/* Popular Dishes List */}
      {filteredDishes.length === 0 ? (
        <div className="p-8 text-center bg-white border border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {dishes.length === 0 ? 'No featured dishes yet' : 'No dishes match your search'}
          </p>
          {dishes.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Dishes automatically become popular after 10+ orders. You can also manually feature custom combinations.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDishes.map((dish) => (
            <div key={dish.id} className="bg-white border border-border rounded-lg overflow-hidden flex flex-col">
              {/* Image */}
              <div className="relative w-full h-40 bg-muted/20 overflow-hidden flex items-center justify-center">
                {dish.featured_image_url ? (
                  <Image
                    src={dish.featured_image_url}
                    alt={dish.combination_name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground text-xs">No image</div>
                )}
              </div>

              {/* Content */}
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{dish.combination_name}</h3>
                {dish.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{dish.description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-col mt-auto">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEditDish(dish)}
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleDeleteDish(dish.id)}
                    disabled={deletingId === dish.id}
                    variant="outline"
                    className="w-full h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
