'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Upload, X, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface MenuItem {
  id: string;
  name: string;
}

interface AddonOption {
  name: string;
  price: string;
}

interface Addon {
  id?: string;
  name: string;
  addon_type: string;
  description?: string;
  price?: number;
  image_url?: string;
  is_required: boolean;
  allow_multiple: boolean;
  options?: Array<{ id?: string; name: string; price: number }>;
}

interface AddonFormProps {
  addon?: Addon;
  isEditing?: boolean;
}

export default function AddonForm({ addon, isEditing = false }: AddonFormProps) {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: addon?.name || '',
    addonType: addon?.addon_type || 'protein',
    description: addon?.description || '',
    price: addon?.price?.toString() || '',
    isRequired: addon?.is_required || false,
    allowMultiple: addon?.allow_multiple ?? true,
    imageFile: null as File | null,
    imageUrl: addon?.image_url || '',
    options: addon?.options?.map(o => ({ name: o.name, price: o.price.toString() })) || [{ name: '', price: '' }],
    pairedMenuItems: (addon as any)?.pairedMenuItems || [], // New: paired menu items
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(addon?.image_url || null);

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      const response = await fetch('/api/business/menu-items');
      const data = await response.json();
      setMenuItems(data.menuItems || []);
    } catch (err) {
      console.error('Error fetching menu items:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      
      if (!cloudName) {
        throw new Error('Cloudinary configuration missing');
      }

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload a valid image file');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      const formDataObj = new FormData();
      formDataObj.append('file', file);
      formDataObj.append('upload_preset', 'foodbase_upload');
      formDataObj.append('folder', 'foodbase/addons');
      formDataObj.append('resource_type', 'auto');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formDataObj,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText || response.statusText } };
        }
        throw new Error(`Upload failed: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.secure_url;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[v0] Upload error:', errorMsg);
      setError(`Failed to upload image: ${errorMsg}`);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, imageFile: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, imageFile: null, imageUrl: '' });
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const customOptions = formData.options.filter((o) => o.name.trim());
    const hasMenuItems = formData.pairedMenuItems.length > 0;
    const hasOptions = customOptions.length > 0;

    if (!formData.name || (!hasMenuItems && !hasOptions)) {
      setError('Name and at least one menu item or custom option are required');
      return;
    }

    if (!isEditing && !formData.imageFile) {
      setError('Image is required for new addons');
      return;
    }

    setSubmitting(true);
    let imageUrl = formData.imageUrl;

    // Upload image if selected
    if (formData.imageFile) {
      imageUrl = await uploadImageToCloudinary(formData.imageFile);
      if (!imageUrl) {
        setSubmitting(false);
        return;
      }
    }

    try {
      const endpoint = isEditing
        ? `/api/business/addons/${addon?.id}`
        : '/api/business/addons';
      const method = isEditing ? 'PATCH' : 'POST';

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
          options: customOptions.map((o) => ({ name: o.name, price: o.price ? parseFloat(o.price) : 0 })),
          pairedMenuItems: formData.pairedMenuItems,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save addon');
        return;
      }

      router.push('/dashboard/addons');
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
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

  const toggleMenuItemPairing = (menuItemId: string) => {
    setFormData((prev) => ({
      ...prev,
      pairedMenuItems: prev.pairedMenuItems.includes(menuItemId)
        ? prev.pairedMenuItems.filter((id) => id !== menuItemId)
        : [...prev.pairedMenuItems, menuItemId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="bg-white border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">{isEditing ? 'Edit Add-on' : 'Add New Add-on'}</h2>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Image Upload */}
        <div>
          <Label className="text-xs font-semibold mb-2 block">Add-on Image</Label>
          <div className="space-y-3">
            {previewUrl ? (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground mb-2">Drag and drop or click to upload</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Image
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Add-on Name */}
        <div>
          <Label htmlFor="name" className="text-xs font-semibold">
            Add-on Name *
          </Label>
          <Input
            id="name"
            placeholder="e.g., Protein"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 h-8 text-xs"
          />
        </div>

        {/* Type & Price */}
        <div className="grid grid-cols-2 gap-4">
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

        {/* Description */}
        <div>
          <Label htmlFor="description" className="text-xs font-semibold">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="e.g., Choose your protein..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 text-xs min-h-20"
          />
        </div>

        {/* Checkboxes */}
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

        {/* Options */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold">Options - Select Menu Items *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={addOptionField}
            >
              Add Custom Option
            </Button>
          </div>
          
          {/* Menu Items Selection */}
          {menuItems.length > 0 && (
            <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-2">Select Menu Items as Options:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {menuItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.pairedMenuItems.includes(item.id)}
                      onChange={() => toggleMenuItemPairing(item.id)}
                      className="w-3 h-3"
                    />
                    <span className="flex-1">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Custom Options */}
          <div className="space-y-2">
            {formData.options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="e.g., Custom Option"
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

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={submitting || uploadingImage}
            className="flex-1 h-9 text-xs bg-primary text-white hover:bg-primary-dark"
          >
            {submitting ? 'Saving...' : isEditing ? 'Update Add-on' : 'Add Add-on'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-9 text-xs"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
