'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle, Upload, Edit2, Eye, EyeOff, Search, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { DiscountBadge } from '@/components/discount-badge';

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
  discount_type?: string | null;
  discount_value?: number | null;
  discounted_price?: number | null;
}

interface Category {
  id: string;
  name: string;
}

export default function MenuPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDeleteMenuItem = async (menuId: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      setDeletingId(menuId);
      const response = await fetch(`/api/business/menu-items/${menuId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete menu item');
        return;
      }

      setMenuItems(menuItems.filter(item => item.id !== menuId));
    } catch (err) {
      console.error('Error deleting menu item:', err);
      setError('Failed to delete menu item');
    } finally {
      setDeletingId(null);
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



  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading menu items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Quick Actions Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          onClick={() => router.push('/dashboard/addons')}
          className="h-7 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add-ons
        </Button>
        <Button
          onClick={() => router.push('/dashboard/drinks')}
          className="h-7 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-3 h-3 mr-1" />
          Drinks
        </Button>
        <Button
          onClick={() => router.push('/dashboard/menu/categories')}
          className="h-7 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-3 h-3 mr-1" />
          Categories
        </Button>
        <Button
          onClick={() => router.push('/dashboard/menu/popular-dishes')}
          className="h-7 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-3 h-3 mr-1" />
          Popular Dishes
        </Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Menu Items</h1>
          <p className="text-xs text-muted-foreground">Manage your main dishes and plates</p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/menu/new')}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                    <div>
                      {item.discount_type ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs line-through text-gray-500">
                            {formatCurrency(item.price)}
                          </span>
                          <span className="font-bold text-green-600">
                            {formatCurrency(item.discounted_price || item.price)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold text-primary">{formatCurrency(item.price)}</span>
                      )}
                    </div>
                  </div>
                  {item.discount_type && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold text-xs">
                        {item.discount_type === 'percentage' 
                          ? `${item.discount_value}% Off` 
                          : `-₦${item.discount_value?.toFixed(2)}`}
                      </span>
                    </div>
                  )}
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
                <div className="flex gap-2 flex-col">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/dashboard/menu/edit/${item.id}`)}
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
                  <Button
                    onClick={() => handleDeleteMenuItem(item.id)}
                    disabled={deletingId === item.id}
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
