'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Upload, X } from 'lucide-react';
import Image from 'next/image';

interface PopularDish {
  id?: string;
  combination_name: string;
  description?: string;
  featured_image_url?: string;
}

interface PopularDishFormProps {
  dish?: PopularDish;
  isEditing?: boolean;
}

export default function PopularDishForm({ dish, isEditing = false }: PopularDishFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    combinationName: dish?.combination_name || '',
    description: dish?.description || '',
    imageFile: null as File | null,
    imageUrl: dish?.featured_image_url || '',
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(dish?.featured_image_url || null);

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
      formDataObj.append('folder', 'foodbase/popular');
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

    if (!formData.combinationName) {
      setError('Combination name is required');
      return;
    }

    if (!isEditing && !formData.imageFile) {
      setError('Image is required for new dishes');
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
        ? `/api/business/popular-dishes/${dish?.id}`
        : '/api/business/popular-dishes';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combinationName: formData.combinationName,
          description: formData.description,
          featuredImageUrl: imageUrl || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save dish');
        return;
      }

      router.push('/dashboard/popular');
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
        <h2 className="text-2xl font-bold">{isEditing ? 'Edit Featured Dish' : 'Add Popular Combination'}</h2>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Image Upload */}
        <div>
          <Label className="text-xs font-semibold mb-2 block">Featured Image</Label>
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

        {/* Combination Name */}
        <div>
          <Label htmlFor="name" className="text-xs font-semibold">
            Combination Name *
          </Label>
          <Input
            id="name"
            placeholder="e.g., Jollof & Chicken Special"
            value={formData.combinationName}
            onChange={(e) => setFormData({ ...formData, combinationName: e.target.value })}
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
            placeholder="Describe this featured combo..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 text-xs min-h-20"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={submitting || uploadingImage}
            className="flex-1 h-9 text-xs bg-primary text-white hover:bg-primary-dark"
          >
            {submitting ? 'Saving...' : isEditing ? 'Update Dish' : 'Add Featured Dish'}
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
