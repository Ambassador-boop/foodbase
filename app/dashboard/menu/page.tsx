'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  AlertCircle,
  Edit2,
  Eye,
  EyeOff,
  Search,
  Trash2,
  Palette,
  Utensils,
  CheckCircle2,
  XCircle,
  ImageIcon,
} from 'lucide-react';
import Image from 'next/image';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price?: number;
  category_id?: string;
  category_name?: string;
  image_url?: string;
  is_available: boolean;
  order_count: number;
  discount_type?: string | null;
  discount_value?: number | null;
  discounted_price?: number | null;
}

export default function MenuPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    if (filter === 'available') filtered = filtered.filter((i) => i.is_available);
    if (filter === 'unavailable') filtered = filtered.filter((i) => !i.is_available);
    setFilteredItems(filtered);
  }, [searchTerm, menuItems, filter]);

  const fetchData = async () => {
    try {
      const menuRes = await fetch('/api/business/menu-items', {
        credentials: 'include',
      });
      if (!menuRes.ok) throw new Error('Failed to fetch data');
      const menuData = await menuRes.json();
      setMenuItems(menuData.menuItems || []);
      setFilteredItems(menuData.menuItems || []);
    } catch (err) {
      setError('Failed to load menu items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMenuItem = async (menuId: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
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
      setMenuItems(menuItems.filter((item) => item.id !== menuId));
    } catch (err) {
      console.error('Error deleting menu item:', err);
      setError('Failed to delete menu item');
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);

  const handleToggleAvailable = async (menuId: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/business/menu-items/${menuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentState }),
      });
      if (response.ok) {
        setMenuItems(
          menuItems.map((item) =>
            item.id === menuId ? { ...item, is_available: !currentState } : item,
          ),
        );
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  // Stats
  const totalItems = menuItems.length;
  const availableCount = menuItems.filter((i) => i.is_available).length;
  const unavailableCount = totalItems - availableCount;
  const totalOrders = menuItems.reduce((s, i) => s + (i.order_count || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-xs">Loading menu items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 sm:p-6 text-primary-foreground">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -right-4 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Utensils className="w-4 h-4" />
              <span className="text-xs font-medium opacity-90">Menu Items</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Manage your menu
            </h1>
            <p className="text-xs sm:text-sm opacity-90 max-w-md text-pretty">
              Add, edit, and organize the dishes that make your restaurant shine.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => router.push('/dashboard/menu/customize')}
              variant="outline"
              className="h-9 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              Customize
            </Button>
            <Button
              onClick={() => router.push('/dashboard/menu/new')}
              className="h-9 text-xs bg-white text-primary hover:bg-white/90"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Item
            </Button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total items"
          value={totalItems}
          icon={<Utensils className="w-4 h-4" />}
          tone="primary"
        />
        <StatCard
          label="Available"
          value={availableCount}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="success"
        />
        <StatCard
          label="Hidden"
          value={unavailableCount}
          icon={<XCircle className="w-4 h-4" />}
          tone="muted"
        />
        <StatCard
          label="Total orders"
          value={totalOrders}
          icon={<ImageIcon className="w-4 h-4" />}
          tone="accent"
        />
      </div>

      {error && (
        <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm bg-card border-border"
          />
        </div>
        <div className="flex gap-1 bg-muted/30 p-1 rounded-lg">
          {(['all', 'available', 'unavailable'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors flex-1 sm:flex-none ${
                filter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<Utensils className="w-8 h-8" />}
          title={
            menuItems.length === 0 ? 'No menu items yet' : 'No matching items'
          }
          description={
            menuItems.length === 0
              ? 'Start building your menu by adding your first dish.'
              : 'Try a different search or filter.'
          }
          action={
            menuItems.length === 0 ? (
              <Button
                onClick={() => router.push('/dashboard/menu/new')}
                className="h-9 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add your first item
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              onEdit={() => router.push(`/dashboard/menu/edit/${item.id}`)}
              onToggle={() => handleToggleAvailable(item.id, item.is_available)}
              onDelete={() => handleDeleteMenuItem(item.id)}
              deleting={deletingId === item.id}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'primary' | 'success' | 'muted' | 'accent';
}) {
  const tones: Record<typeof tone, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-700',
    muted: 'bg-muted/40 text-muted-foreground',
    accent: 'bg-secondary/10 text-secondary',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-bold text-foreground leading-tight">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function MenuCard({
  item,
  onEdit,
  onToggle,
  onDelete,
  deleting,
  formatCurrency,
}: {
  item: MenuItem;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:border-primary/30 hover:shadow-md">
      <div className="relative w-full aspect-[4/3] bg-muted/20 overflow-hidden">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-10 h-10 opacity-30" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${
              item.is_available
                ? 'bg-emerald-500/90 text-white'
                : 'bg-foreground/70 text-background'
            }`}
          >
            {item.is_available ? 'Available' : 'Hidden'}
          </span>
          {item.discount_type && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/90 text-white">
              {item.discount_type === 'percentage'
                ? `-${item.discount_value}%`
                : `-${formatCurrency(Number(item.discount_value || 0))}`}
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground">
            {item.name}
          </h3>
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
            {item.description}
          </p>
        )}

        <div className="flex items-end justify-between gap-2 mb-3 mt-auto">
          <div>
            {item.discount_type && item.original_price ? (
              <div className="flex flex-col">
                <span className="text-[10px] line-through text-muted-foreground">
                  {formatCurrency(Number(item.original_price))}
                </span>
                <span className="text-base font-bold text-emerald-600">
                  {formatCurrency(Number(item.price))}
                </span>
              </div>
            ) : (
              <span className="text-base font-bold text-primary">
                {formatCurrency(Number(item.price))}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            {item.category_name && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-foreground/70">
                {item.category_name}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {item.order_count} {item.order_count === 1 ? 'order' : 'orders'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            onClick={onEdit}
            variant="outline"
            className="h-8 text-[11px] px-1"
            aria-label="Edit"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            onClick={onToggle}
            variant="outline"
            className="h-8 text-[11px] px-1"
            aria-label={item.is_available ? 'Hide' : 'Show'}
          >
            {item.is_available ? (
              <>
                <EyeOff className="w-3 h-3 mr-1" />
                Hide
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 mr-1" />
                Show
              </>
            )}
          </Button>
          <Button
            onClick={onDelete}
            disabled={deleting}
            variant="outline"
            className="h-8 text-[11px] px-1 text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20"
            aria-label="Delete"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {deleting ? '...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
        {description}
      </p>
      {action}
    </div>
  );
}
