// next-cloudinary configuration and utilities
import { CldUploadWidget, CldImage } from 'next-cloudinary';

export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
};

export const validateCloudinaryConfig = () => {
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set');
  }
  if (!process.env.CLOUDINARY_API_KEY) {
    throw new Error('CLOUDINARY_API_KEY is not set');
  }
  if (!process.env.CLOUDINARY_API_SECRET) {
    throw new Error('CLOUDINARY_API_SECRET is not set');
  }
};

// Server-side upload for API routes using Cloudinary API
export async function uploadImage(
  file: File | Buffer,
  folder: string,
  fileName?: string
): Promise<string> {
  try {
    // Validate only the client-side required config
    if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
      throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set');
    }

    const formData = new FormData();
    
    if (file instanceof Buffer) {
      formData.append('file', new Blob([file], { type: 'application/octet-stream' }));
    } else {
      formData.append('file', file);
    }
    
    formData.append('upload_preset', 'foodbase_upload');
    formData.append('folder', `foodbase/${folder}`);
    if (fileName) {
      formData.append('public_id', fileName);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudinary upload failed: ${error}`);
    }

    const data = await response.json() as any;
    return data.secure_url || '';
  } catch (error) {
    console.error('[v0] Cloudinary upload error:', error);
    throw error;
  }
}

// Generate Cloudinary image URL with transformations
export function getImageUrl(publicId: string, width = 400, height = 400): string {
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    return '';
  }

  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},c_fill,q_auto/${publicId}`;
}

// Delete image from Cloudinary (requires admin API token)
export async function deleteImage(publicId: string): Promise<void> {
  try {
    // Validate all required configs for deletion
    if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
      throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set');
    }
    if (!process.env.CLOUDINARY_API_KEY) {
      throw new Error('CLOUDINARY_API_KEY is not set');
    }
    if (!process.env.CLOUDINARY_API_SECRET) {
      throw new Error('CLOUDINARY_API_SECRET is not set');
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/resources/image/upload`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
          ).toString('base64')}`,
        },
        body: JSON.stringify({ public_ids: [publicId] }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete image: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[v0] Cloudinary delete error:', error);
    throw error;
  }
}

// Export next-cloudinary components for client-side use
export { CldUploadWidget, CldImage };
