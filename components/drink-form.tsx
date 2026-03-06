'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Upload, X } from 'lucide-react';
import Image from 'next/image';

interface Drink {
  id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
}

interface DrinkFormProps {
  drink?: Drink;
  isEditing?: boolean;
}

export default function DrinkForm({ drink, isEditing = false }: DrinkFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: drink?.name || '',
    description: drink?.description || '',
    price: drink?.price.toString() || '',
    imageFile: null as File | null,
    imageUrl: drink?.image_url || '',
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(drink?.image_url || null);

  const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      
      if (!cloudName) {
        throw new Error('Cloudinary configuration missing');
      }

      const formDataObj = new FormData();
      formDataObj.append('file', file);
      formDataObj.append('upload_preset', 'foodbase_upload');
      formDataObj.append('folder', 'foodbase/drinks');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
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
      setError('Image is required for new drinks');
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
        ? `/api/business/drinks/${drink?.id}`
        : '/api/business/drinks';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          imageUrl: imageUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save drink');
        return;
      }

      router.push('/dashboard/drinks');
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="bg-white border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">{isEditing ? 'Edit Drink' : 'Add New Drink'}</h2>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Image Upload */}
        <div>
          <Label className="text-xs font-semibold mb-2 block">Drink Image</Label>
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

        {/* Drink Name */}
        <div>
          <Label htmlFor="name" className="text-xs font-semibold">
            Drink Name *
          </Label>
          <Input
            id="name"
            placeholder="e.g., Coca Cola"
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
            placeholder="Describe the drink..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 text-xs min-h-20"
          />
        </div>

        {/* Price */}
        <div>
          <Label htmlFor="price" className="text-xs font-semibold">
            Price (NGN) *
          </Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            placeholder="500"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="mt-1 h-8 text-xs"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={submitting || uploadingImage}
            className="flex-1 h-9 text-xs bg-primary text-white hover:bg-primary-dark"
          >
            {submitting ? 'Saving...' : isEditing ? 'Update Drink' : 'Add Drink'}
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
