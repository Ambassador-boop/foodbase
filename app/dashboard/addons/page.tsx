'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle, Trash2 } from 'lucide-react';

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
  is_required: boolean;
  allow_multiple: boolean;
  options?: AddonOption[];
}

export default function AddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    addonType: 'protein',
    description: '',
    isRequired: false,
    allowMultiple: true,
    options: [''],
  });

  useEffect(() => {
    fetchAddons();
  }, []);

  const fetchAddons = async () => {
    try {
      const response = await fetch('/api/business/addons');
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

  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || formData.options.filter((o) => o.trim()).length === 0) {
      setError('Name and at least one option are required');
      return;
    }

    try {
      const response = await fetch('/api/business/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          addonType: formData.addonType,
          description: formData.description,
          isRequired: formData.isRequired,
          allowMultiple: formData.allowMultiple,
          options: formData.options
            .filter((o) => o.trim())
            .map((o) => ({ name: o, price: 0 })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add addon');
        return;
      }

      setAddons([data.addon, ...addons]);
      setFormData({
        name: '',
        addonType: 'protein',
        description: '',
        isRequired: false,
        allowMultiple: true,
        options: [''],
      });
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    }
  };

  const addOptionField = () => {
    setFormData({
      ...formData,
      options: [...formData.options, ''],
    });
  };

  const removeOptionField = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading add-ons...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Add-ons</h1>
          <p className="text-xs text-muted-foreground">Manage proteins, sides, toppings, and extras</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add-on
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
            <h2 className="text-sm font-semibold">Add New Add-on Group</h2>
            <button onClick={() => setShowForm(false)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddAddon} className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Add-on Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Protein"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="type" className="text-xs font-semibold">
                Type
              </Label>
              <select
                id="type"
                value={formData.addonType}
                onChange={(e) => setFormData({ ...formData, addonType: e.target.value })}
                className="mt-1 h-8 w-full text-xs border border-input rounded px-2 py-1"
              >
                <option value="protein">Protein</option>
                <option value="side">Side</option>
                <option value="topping">Topping</option>
                <option value="extra">Extra</option>
              </select>
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-semibold">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="e.g., Choose your protein..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 text-xs min-h-12"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={formData.isRequired}
                  onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                />
                <span>Required for all dishes</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={formData.allowMultiple}
                  onChange={(e) => setFormData({ ...formData, allowMultiple: e.target.checked })}
                />
                <span>Allow multiple selections</span>
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">Options</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={addOptionField}
                >
                  Add Option
                </Button>
              </div>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="e.g., Chicken"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    {formData.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOptionField(index)}
                        className="p-1 hover:bg-red-50 rounded text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Add Add-on
            </Button>
          </form>
        </div>
      )}

      {/* Add-ons List */}
      <div className="space-y-3">
        {addons.length === 0 ? (
          <div className="bg-white border border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">No add-ons yet. Create your first add-on group!</p>
          </div>
        ) : (
          addons.map((addon) => (
            <div key={addon.id} className="bg-white border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{addon.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {addon.addon_type}
                    </span>
                    {addon.is_required && (
                      <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                        Required
                      </span>
                    )}
                    {addon.allow_multiple && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        Multiple
                      </span>
                    )}
                  </div>
                  {addon.description && (
                    <p className="text-xs text-muted-foreground mt-2">{addon.description}</p>
                  )}
                </div>
              </div>

              {addon.options && addon.options.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">Options:</p>
                  <div className="flex flex-wrap gap-2">
                    {addon.options.map((opt) => (
                      <span key={opt.id} className="text-xs bg-muted px-2 py-1 rounded">
                        {opt.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
