'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle, Edit2, Eye, EyeOff, Search, Upload, Trash2 } from 'lucide-react';
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

export default function AddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [filteredAddons, setFilteredAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    addonType: 'protein',
    description: '',
    price: '',
    isRequired: false,
    allowMultiple: true,
    imageFile: null as File | null,
    imageUrl: '',
    options: [{ name: '', price: '' }],
  });

  useEffect(() => {
    fetchAddons();
  }, []);

  useEffect(() => {
    // Filter addons based on search term
    const filtered = addons.filter(addon =>
      addon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      addon.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAddons(filtered);
  }, [searchTerm, addons]);

  const fetchAddons = async () => {
    try {
      const response = await fetch('/api/business/addons');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setAddons(data.addons || []);
      setFilteredAddons(data.addons || []);
    } catch (err) {
      setError('Failed to load add-ons');
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
      formDataObj.append('folder', 'foodbase/addons');

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

  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || formData.options.filter((o) => o.name.trim()).length === 0) {
      setError('Name and at least one option are required');
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
        ? `/api/business/addons/${editingId}`
        : '/api/business/addons';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          addonType: formData.addonType,
          description: formData.description,
          price: formData.price ? parseFloat(formData.price) : 0,
          imageUrl: imageUrl || null,
          isRequired: formData.isRequired,
          allowMultiple: formData.allowMultiple,
          options: formData.options
            .filter((o) => o.name.trim())
            .map((o) => ({ name: o.name, price: o.price ? parseFloat(o.price) : 0 })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save addon');
        setUploading(false);
        return;
      }

      if (editingId) {
        setAddons(addons.map(item => item.id === editingId ? data.addon : item));
      } else {
        setAddons([data.addon, ...addons]);
      }

      setFormData({
        name: '',
        addonType: 'protein',
        description: '',
        price: '',
        isRequired: false,
        allowMultiple: true,
        imageFile: null,
        imageUrl: '',
        options: [{ name: '', price: '' }],
      });
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleAvailable = async (addonId: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/business/addons/${addonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentState }),
      });

      if (response.ok) {
        setAddons(addons.map(item =>
          item.id === addonId ? { ...item, is_available: !currentState } : item
        ));
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  const handleEditAddon = (addon: Addon) => {
    setFormData({
      name: addon.name,
      addonType: addon.addon_type,
      description: addon.description || '',
      price: addon.price?.toString() || '',
      isRequired: addon.is_required,
      allowMultiple: addon.allow_multiple,
      imageFile: null,
      imageUrl: addon.image_url || '',
      options: addon.options || [{ name: '', price: '' }],
    });
    setEditingId(addon.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addOptionField = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { name: '', price: '' }],
    });
  };

  const removeOptionField = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (index: number, field: 'name' | 'price', value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, options: newOptions });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

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
            <h2 className="text-sm font-semibold">{editingId ? 'Edit Add-on' : 'Add New Add-on'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1">
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

            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="price" className="text-xs font-semibold">
                  Base Price (NGN)
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
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

            <div>
              <Label className="text-xs font-semibold">Add-on Image</Label>
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
                      id="addon-image"
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
                      value={option.name}
                      onChange={(e) => updateOption(index, 'name', e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      placeholder="Price (0 for free)"
                      type="number"
                      step="0.01"
                      value={option.price}
                      onChange={(e) => updateOption(index, 'price', e.target.value)}
                      className="h-8 text-xs w-20"
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

            <Button type="submit" disabled={uploading} className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              {uploading ? 'Uploading...' : editingId ? 'Update Add-on' : 'Add Add-on'}
            </Button>
          </form>
        </div>
      )}

      {/* Search Bar */}
      {addons.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search add-ons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      )}

      {/* Add-ons Card Grid */}
      {filteredAddons.length === 0 ? (
        <div className="p-8 text-center bg-white border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">
            {addons.length === 0 ? 'No add-ons yet. Create your first add-on group!' : 'No add-ons match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAddons.map((addon) => (
            <div key={addon.id} className="bg-white border border-border rounded-lg overflow-hidden flex flex-col">
              {/* Image */}
              <div className="relative w-full h-40 bg-muted/20 overflow-hidden flex items-center justify-center">
                {addon.image_url ? (
                  <Image
                    src={addon.image_url}
                    alt={addon.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground text-xs">No image</div>
                )}
              </div>

              {/* Content */}
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{addon.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{addon.description}</p>

                <div className="space-y-2 mt-auto">
                  <div className="flex flex-wrap gap-1">
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

                  {addon.options && addon.options.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Options:</p>
                      <div className="space-y-1">
                        {addon.options.map((opt) => (
                          <div key={opt.id} className="text-xs text-muted-foreground">
                            {opt.name} {opt.price > 0 && `(+${formatCurrency(opt.price)})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-3 mb-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      addon.is_available
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {addon.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEditAddon(addon)}
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleToggleAvailable(addon.id, addon.is_available)}
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                  >
                    {addon.is_available ? (
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
