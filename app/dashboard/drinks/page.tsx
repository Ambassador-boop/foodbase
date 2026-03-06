'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle, Edit2, Eye, EyeOff, Search } from 'lucide-react';
import Image from 'next/image';

interface Drink {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
}

export default function DrinksPage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [filteredDrinks, setFilteredDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageFile: null as File | null,
    imageUrl: '',
  });

  useEffect(() => {
    fetchDrinks();
  }, []);

  useEffect(() => {
    // Filter drinks based on search term
    const filtered = drinks.filter(drink =>
      drink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drink.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredDrinks(filtered);
  }, [searchTerm, drinks]);

  const fetchDrinks = async () => {
    try {
      const response = await fetch('/api/business/drinks');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setDrinks(data.drinks || []);
      setFilteredDrinks(data.drinks || []);
    } catch (err) {
      setError('Failed to load drinks');
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
      formDataObj.append('folder', 'foodbase/drinks');

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

  const handleAddDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.price) {
      setError('Name and price are required');
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
        ? `/api/business/drinks/${editingId}`
        : '/api/business/drinks';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          imageUrl: imageUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save drink');
        setUploading(false);
        return;
      }

      if (editingId) {
        setDrinks(drinks.map(item => item.id === editingId ? data.drink : item));
      } else {
        setDrinks([data.drink, ...drinks]);
      }

      setFormData({ name: '', description: '', price: '', imageFile: null, imageUrl: '' });
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const handleToggleAvailable = async (drinkId: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/business/drinks/${drinkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentState }),
      });

      if (response.ok) {
        setDrinks(drinks.map(item =>
          item.id === drinkId ? { ...item, is_available: !currentState } : item
        ));
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  const handleEditDrink = (drink: Drink) => {
    setFormData({
      name: drink.name,
      description: drink.description || '',
      price: drink.price.toString(),
      imageFile: null,
      imageUrl: drink.image_url || '',
    });
    setEditingId(drink.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading drinks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Drinks</h1>
          <p className="text-xs text-muted-foreground">Manage beverages and drinks</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', description: '', price: '', imageFile: null, imageUrl: '' });
            setShowForm(!showForm);
          }}
          className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Drink
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
            <h2 className="text-sm font-semibold">{editingId ? 'Edit Drink' : 'Add New Drink'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddDrink} className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Drink Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Coca Cola"
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
                placeholder="Describe the drink..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 text-xs min-h-16"
              />
            </div>

            <div>
              <Label htmlFor="price" className="text-xs font-semibold">
                Price (NGN)
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="500"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="imageUrl" className="text-xs font-semibold">
                Image URL (Cloudinary)
              </Label>
              <Input
                id="imageUrl"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <Button type="submit" disabled={uploading} className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              {uploading ? 'Uploading...' : editingId ? 'Update Drink' : 'Add Drink'}
            </Button>
          </form>
        </div>
      )}

      {/* Search Bar */}
      {drinks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search drinks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      )}

      {/* Drinks Card Grid */}
      {filteredDrinks.length === 0 ? (
        <div className="p-8 text-center bg-white border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">
            {drinks.length === 0 ? 'No drinks added yet. Add your first drink!' : 'No drinks match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrinks.map((drink) => (
            <div key={drink.id} className="bg-white border border-border rounded-lg overflow-hidden flex flex-col">
              {/* Image */}
              <div className="relative w-full h-40 bg-muted/20 overflow-hidden flex items-center justify-center">
                {drink.image_url ? (
                  <Image
                    src={drink.image_url}
                    alt={drink.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground text-xs">No image</div>
                )}
              </div>

              {/* Content */}
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{drink.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{drink.description}</p>

                <div className="space-y-2 mt-auto">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-bold text-primary">{formatCurrency(drink.price)}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mt-3 mb-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      drink.is_available
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {drink.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEditDrink(drink)}
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleToggleAvailable(drink.id, drink.is_available)}
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                  >
                    {drink.is_available ? (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3 mr-1" />
                        Show
                      </>
                    )}
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
