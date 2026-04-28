'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  X,
  AlertCircle,
  FolderOpen,
  Edit2,
  Trash2,
  Search,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filtered, setFiltered] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setFiltered(
      categories.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );
  }, [searchTerm, categories]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/business/categories', {
        credentials: 'include',
      });
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

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: '', description: '' });
    setShowPanel(true);
    setError('');
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setShowPanel(true);
    setError('');
  };

  const closePanel = () => {
    setShowPanel(false);
    setEditingId(null);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setSubmitting(true);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const response = await fetch('/api/business/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId ? { id: editingId, ...formData } : formData,
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to save category');
        return;
      }
      if (editingId) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingId ? data.category : c)),
        );
      } else {
        setCategories((prev) => [data.category, ...prev]);
      }
      closePanel();
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        'Delete this category? Items in this category will become uncategorized.',
      )
    )
      return;
    try {
      const response = await fetch(
        `/api/business/categories?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete category');
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete category');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-xs">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 p-5 sm:p-6 text-secondary-foreground">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FolderOpen className="w-4 h-4" />
              <span className="text-xs font-medium opacity-90">Categories</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Organize your menu
            </h1>
            <p className="text-xs sm:text-sm opacity-90 max-w-md text-pretty">
              Group similar dishes into categories so customers can browse with
              ease.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="h-9 text-xs bg-white text-secondary hover:bg-white/90"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Category
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      {categories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm bg-card"
          />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-3">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {categories.length === 0
              ? 'No categories yet'
              : 'No matching categories'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            {categories.length === 0
              ? 'Create your first category to start organizing your menu.'
              : 'Try a different search.'}
          </p>
          {categories.length === 0 && (
            <Button onClick={openCreate} className="h-9 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create category
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filtered.map((category) => (
            <div
              key={category.id}
              className="group bg-card border border-border rounded-xl p-4 transition-all hover:border-secondary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-1">
                    {category.name}
                  </h3>
                  {category.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {category.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 mt-0.5 italic">
                      No description
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(category.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(category)}
                    className="w-7 h-7 rounded-md hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Edit category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="w-7 h-7 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side Panel (right side on desktop, bottom sheet on mobile) */}
      {showPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-150"
            onClick={closePanel}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Edit category' : 'New category'}
            className="fixed z-50 bg-card border-border shadow-2xl flex flex-col
                       inset-x-0 bottom-0 rounded-t-2xl border-t max-h-[90vh]
                       sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto
                       sm:rounded-t-none sm:rounded-l-2xl sm:border-t-0 sm:border-l
                       sm:w-full sm:max-w-md sm:max-h-none
                       animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
          >
            <header className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-bold">
                  {editingId ? 'Edit Category' : 'New Category'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingId
                    ? 'Update the details for this category.'
                    : 'Add a new way to group your menu items.'}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="w-8 h-8 rounded-md hover:bg-muted/50 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {error && (
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <Label htmlFor="cat-name" className="text-xs font-semibold">
                  Category name
                </Label>
                <Input
                  id="cat-name"
                  placeholder="e.g., Rice Dishes"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1.5 h-10 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <Label
                  htmlFor="cat-description"
                  className="text-xs font-semibold"
                >
                  Description
                </Label>
                <Textarea
                  id="cat-description"
                  placeholder="Briefly describe this category..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: e.target.value,
                    })
                  }
                  className="mt-1.5 text-sm min-h-24"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Optional. Helps customers understand what to expect.
                </p>
              </div>
            </form>

            <footer className="p-5 border-t border-border flex gap-2">
              <Button
                variant="outline"
                onClick={closePanel}
                className="flex-1 h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={submitting}
                className="flex-1 h-9 text-xs"
              >
                {submitting
                  ? 'Saving...'
                  : editingId
                    ? 'Save changes'
                    : 'Create category'}
              </Button>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
