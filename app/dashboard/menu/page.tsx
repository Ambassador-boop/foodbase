'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle, Upload, Edit2, Eye, EyeOff, Search } from 'lucide-react';
import Image from 'next/image';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  category_name?: string;
  image_url?: string;
  is_available: boolean;
  order_count: number;
}

interface Category {
  id: string;
  name: string;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    categoryId: '',
    imageFile: null as File | null,
    imageUrl: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Filter items based on search term
    const filtered = menuItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [searchTerm, menuItems]);

  const fetchData = async () => {
    try {
      const [menuRes, catRes] = await Promise.all([
        fetch('/api/business/menu-items'),
        fetch('/api/business/categories'),
      ]);

      if (!menuRes.ok || !catRes.ok) throw new Error('Failed to fetch data');

      const menuData = await menuRes.json();
      const catData = await catRes.json();

      setMenuItems(menuData.menuItems || []);
      setFilteredItems(menuData.menuItems || []);
      setCategories(catData.categories || []);
    } catch (err) {
      setError('Failed to load menu items');
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
      formDataObj.append('folder', 'foodbase/menu-items');

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

  const handleAddMenuItem = async (e: React.FormEvent) => {
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
        ? `/api/business/menu-items/${editingId}`
        : '/api/business/menu-items';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          categoryId: formData.categoryId || null,
          imageUrl: imageUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save menu item');
        return;
      }

      if (editingId) {
        setMenuItems(menuItems.map(item => item.id === editingId ? data.menuItem : item));
      } else {
        setMenuItems([data.menuItem, ...menuItems]);
      }
      
      setFormData({ name: '', description: '', price: '', categoryId: '', imageFile: null, imageUrl: '' });
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const handleToggleAvailable = async (menuId: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/business/menu-items/${menuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentState }),
      });

      if (response.ok) {
        setMenuItems(menuItems.map(item =>
          item.id === menuId ? { ...item, is_available: !currentState } : item
        ));
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  const handleEditMenuItem = (item: MenuItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      categoryId: item.category_id || '',
      imageFile: null,
      imageUrl: item.image_url || '',
    });
    setEditingId(item.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading menu items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Menu Items</h1>
          <p className="text-xs text-muted-foreground">Manage your main dishes and plates</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', description: '', price: '', categoryId: '', imageFile: null, imageUrl: '' });
            setShowForm(!showForm);
          }}
          className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Item
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
            <h2 className="text-sm font-semibold">Add New Menu Item</h2>
            <button onClick={() => setShowForm(false)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddMenuItem} className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Item Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Jollof Rice"
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
                placeholder="Describe the dish..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 text-xs min-h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="price" className="text-xs font-semibold">
                  Price (NGN)
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="2500"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="category" className="text-xs font-semibold">
                  Category
                </Label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="mt-1 h-8 w-full text-xs border border-input rounded px-2 py-1"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
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

            <Button type="submit" className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Add Menu Item
            </Button>
          </form>
        </div>
      )}

      {/* Search Bar */}
      {menuItems.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      )}

      {/* Menu Items Card Grid */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-white border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">
            {menuItems.length === 0 ? 'No menu items yet. Add your first dish to get started!' : 'No items match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-white border border-border rounded-lg overflow-hidden flex flex-col">
              {/* Image */}
              <div className="relative w-full h-40 bg-muted/20 overflow-hidden flex items-center justify-center">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground text-xs">No image</div>
                )}
              </div>

              {/* Content */}
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{item.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{item.description}</p>

                <div className="space-y-2 mt-auto">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-bold text-primary">{formatCurrency(item.price)}</span>
                  </div>
                  {item.category_name && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Category:</span>
                      <span>{item.category_name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Orders:</span>
                    <span className="font-medium">{item.order_count}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mt-3 mb-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      item.is_available
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEditMenuItem(item)}
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleToggleAvailable(item.id, item.is_available)}
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                  >
                    {item.is_available ? (
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
