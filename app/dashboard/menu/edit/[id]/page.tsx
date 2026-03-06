'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MenuItemForm from '@/components/menu-item-form';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  image_url?: string;
}

export default function EditMenuItemPage() {
  const params = useParams();
  const id = params.id as string;
  const [menuItem, setMenuItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenuItem();
  }, [id]);

  const fetchMenuItem = async () => {
    try {
      const response = await fetch('/api/business/menu-items');
      const data = await response.json();
      const item = data.menuItems.find((m: MenuItem) => m.id === id);
      if (item) {
        setMenuItem(item);
      }
    } catch (err) {
      console.error('Error fetching menu item:', err);
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

  if (!menuItem) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Menu item not found</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Menu Item</h1>
        <p className="text-muted-foreground text-sm mt-1">Update your dish details</p>
      </div>
      <MenuItemForm menuItem={menuItem} isEditing={true} />
    </div>
  );
}
