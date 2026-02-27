'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  category_name?: string;
  is_available: boolean;
  order_count: number;
}

interface Category {
  id: string;
  name: string;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    imageUrl: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

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
      setCategories(catData.categories || []);
    } catch (err) {
      setError('Failed to load menu items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.price) {
      setError('Name and price are required');
      return;
    }

    try {
      const response = await fetch('/api/business/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          categoryId: formData.categoryId || null,
          imageUrl: formData.imageUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add menu item');
        return;
      }

      setMenuItems([data.menuItem, ...menuItems]);
      setFormData({ name: '', description: '', price: '', categoryId: '', imageUrl: '' });
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading menu items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Menu Items</h1>
          <p className="text-xs text-muted-foreground">Manage your main dishes and plates</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
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

      {/* Menu Items List */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {menuItems.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No menu items yet. Add your first dish to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                  <th className="px-3 py-2 text-center font-semibold">Orders</th>
                  <th className="px-3 py-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {menuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/5">
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-muted-foreground line-clamp-1">{item.description}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.category_name || '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.price)}</td>
                    <td className="px-3 py-2 text-center">{item.order_count}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          item.is_available
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </span>
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
