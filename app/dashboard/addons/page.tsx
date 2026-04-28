'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  Layers,
  ImageIcon,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';

interface AddonOption {
  id: string;
  name: string;
  price: number;
}

interface Addon {
  id: string;
  name: string;
  addon_type: string;
  description?: string;
  price?: number;
  image_url?: string;
  is_required: boolean;
  allow_multiple: boolean;
  is_available: boolean;
  options?: AddonOption[];
}

const TYPE_COLORS: Record<string, string> = {
  protein: 'bg-orange-50 text-orange-700 border-orange-200',
  side: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  topping: 'bg-amber-50 text-amber-700 border-amber-200',
  extra: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function AddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [filtered, setFiltered] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAddons();
  }, []);

  useEffect(() => {
    let f = addons.filter(
      (a) =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    if (typeFilter !== 'all') f = f.filter((a) => a.addon_type === typeFilter);
    setFiltered(f);
  }, [searchTerm, addons, typeFilter]);

  const fetchAddons = async () => {
    try {
      const response = await fetch('/api/business/addons', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAddons(data.addons || []);
    } catch (err) {
      setError('Failed to load add-ons');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailable = async (
    addonId: string,
    currentState: boolean,
  ) => {
    try {
      const response = await fetch(`/api/business/addons/${addonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentState }),
      });
      if (response.ok) {
        setAddons((prev) =>
          prev.map((item) =>
            item.id === addonId
              ? { ...item, is_available: !currentState }
              : item,
          ),
        );
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  const handleDeleteAddon = async (addonId: string) => {
    if (
      !window.confirm(
        'Delete this add-on? It will also be removed from any associated menu items.',
      )
    )
      return;
    try {
      setDeletingId(addonId);
      const response = await fetch(`/api/business/addons/${addonId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete add-on');
        return;
      }
      setAddons((prev) => prev.filter((a) => a.id !== addonId));
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete add-on');
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

  // Stats
  const total = addons.length;
  const available = addons.filter((a) => a.is_available).length;
  const required = addons.filter((a) => a.is_required).length;
  const types = new Set(addons.map((a) => a.addon_type)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-xs">Loading add-ons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 sm:p-6 text-primary-foreground">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -right-4 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-medium opacity-90">Add-ons</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Build your customizations
            </h1>
            <p className="text-xs sm:text-sm opacity-90 max-w-md text-pretty">
              Proteins, sides, toppings, and extras that customers can add to
              their orders.
            </p>
          </div>
          <Link href="/dashboard/addons/new">
            <Button className="h-9 text-xs bg-white text-primary hover:bg-white/90">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Add-on
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Total"
          value={total}
          icon={<Layers className="w-4 h-4" />}
          tone="primary"
        />
        <StatTile
          label="Available"
          value={available}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="success"
        />
        <StatTile
          label="Required"
          value={required}
          icon={<XCircle className="w-4 h-4" />}
          tone="warning"
        />
        <StatTile
          label="Types"
          value={types}
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

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search add-ons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm bg-card"
          />
        </div>
        <div className="flex gap-1 bg-muted/30 p-1 rounded-lg overflow-x-auto">
          {['all', 'protein', 'side', 'topping', 'extra'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {addons.length === 0 ? 'No add-ons yet' : 'No matching add-ons'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            {addons.length === 0
              ? 'Create your first add-on group to give customers more options.'
              : 'Try a different search or filter.'}
          </p>
          {addons.length === 0 && (
            <Link href="/dashboard/addons/new">
              <Button className="h-9 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create your first add-on
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((addon) => (
            <AddonCard
              key={addon.id}
              addon={addon}
              onToggle={() =>
                handleToggleAvailable(addon.id, addon.is_available)
              }
              onDelete={() => handleDeleteAddon(addon.id)}
              deleting={deletingId === addon.id}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'primary' | 'success' | 'warning' | 'accent';
}) {
  const tones: Record<typeof tone, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
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
        <p className="text-lg font-bold leading-tight">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function AddonCard({
  addon,
  onToggle,
  onDelete,
  deleting,
  formatCurrency,
}: {
  addon: Addon;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
  formatCurrency: (n: number) => string;
}) {
  const typeClass =
    TYPE_COLORS[addon.addon_type] ||
    'bg-muted/40 text-muted-foreground border-border';
  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:border-primary/30 hover:shadow-md">
      <div className="relative w-full aspect-[4/3] bg-muted/20 overflow-hidden">
        {addon.image_url ? (
          <Image
            src={addon.image_url}
            alt={addon.name}
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
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm border ${typeClass}`}
          >
            {addon.addon_type}
          </span>
          {!addon.is_available && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-foreground/70 text-background backdrop-blur-sm">
              Hidden
            </span>
          )}
        </div>
        {addon.is_required && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/90 text-white backdrop-blur-sm">
              Required
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm leading-tight line-clamp-1 mb-0.5">
          {addon.name}
        </h3>
        {addon.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
            {addon.description}
          </p>
        )}

        {addon.options && addon.options.length > 0 && (
          <div className="mb-3 mt-auto pt-2 border-t border-dashed border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              {addon.options.length}{' '}
              {addon.options.length === 1 ? 'option' : 'options'}
            </p>
            <div className="space-y-1 max-h-20 overflow-hidden">
              {addon.options.slice(0, 3).map((opt) => (
                <div
                  key={opt.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-foreground/80 truncate">
                    {opt.name}
                  </span>
                  {Number(opt.price) > 0 && (
                    <span className="text-primary font-medium ml-2 flex-shrink-0">
                      +{formatCurrency(Number(opt.price))}
                    </span>
                  )}
                </div>
              ))}
              {addon.options.length > 3 && (
                <p className="text-[10px] text-muted-foreground italic">
                  +{addon.options.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 mt-auto">
          <Link
            href={`/dashboard/addons/edit/${addon.id}`}
            className="col-span-1"
          >
            <Button variant="outline" className="w-full h-8 text-[11px] px-1">
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </Link>
          <Button
            onClick={onToggle}
            variant="outline"
            className="h-8 text-[11px] px-1"
          >
            {addon.is_available ? (
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
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {deleting ? '...' : 'Del'}
          </Button>
        </div>
      </div>
    </div>
  );
}
