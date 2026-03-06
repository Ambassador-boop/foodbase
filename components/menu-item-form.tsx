'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Upload, X } from 'lucide-react';
import Image from 'next/image';

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  image_url?: string;
}

interface MenuItemFormProps {
  menuItem?: MenuItem;
  isEditing?: boolean;
}

export default function MenuItemForm({ menuItem, isEditing = false }: MenuItemFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: menuItem?.name || '',
    description: menuItem?.description || '',
    price: menuItem?.price.toString() || '',
    categoryId: menuItem?.category_id || '',
    imageFile: null as File | null,
    imageUrl: menuItem?.image_url || '',
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(menuItem?.image_url || null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/business/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      
      if (!cloudName) {
        throw new Error('Cloudinary cloud name is not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME environment variable.');
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
      formDataObj.append('folder', 'foodbase/menu-items');
      formDataObj.append('resource_type', 'auto');

      console.log('[v0] Starting Cloudinary upload with cloud name:', cloudName);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formDataObj,
        }
      );

      console.log('[v0] Cloudinary response status:', response.status);

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
      console.log('[v0] Upload successful, URL:', data.secure_url);
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

    if (!formData.name || !formData.price) {
      setError('Name and price are required');
      return;
    }

    if (!isEditing && !formData.imageFile) {
      setError('Image is required for new items');
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
        ? `/api/business/menu-items/${menuItem?.id}`
        : '/api/business/menu-items';
      const method = isEditing ? 'PATCH' : 'POST';

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

      router.push('/dashboard/menu');
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
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
        <h2 className="text-2xl font-bold">{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Image Upload */}
        <div>
          <Label className="text-xs font-semibold mb-2 block">Item Image</Label>
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

        {/* Item Name */}
        <div>
          <Label htmlFor="name" className="text-xs font-semibold">
            Item Name *
          </Label>
          <Input
            id="name"
            placeholder="e.g., Jollof Rice"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 h-8 text-xs"
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description" className="text-xs font-semibold">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Describe the dish..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 text-xs min-h-20"
          />
        </div>

        {/* Price & Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price" className="text-xs font-semibold">
              Price (NGN) *
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
              className="mt-1 h-8 w-full text-xs border border-input rounded px-2"
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

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={submitting || uploadingImage}
            className="flex-1 h-9 text-xs bg-primary text-white hover:bg-primary-dark"
          >
            {submitting ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
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
