'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';

interface ColorConfig {
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  headerColor?: string;
  headerTextColor?: string;
  accentColor?: string;
}

const defaultColors: ColorConfig = {
  backgroundColor: '#f8f6f2',
  textColor: '#1a1a1a',
  buttonColor: '#8E3800',
  buttonTextColor: '#ffffff',
  headerColor: '#ffffff',
  headerTextColor: '#1a1a1a',
  accentColor: '#6b8e23',
};

const pageTypeMap: { [key: string]: string } = {
  menu: '[slug] - Menu',
  add_on: '[slug]/add-on - Add-ons',
  cart: '[slug]/cart - Cart',
  checkout: '[slug]/checkout - Checkout',
  receipt: '[slug]/receipt - Receipt',
};

export default function PreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = searchParams.get('businessId') || '';
  const pageType = searchParams.get('pageType') || 'menu';

  const [colors, setColors] = useState<ColorConfig>(defaultColors);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (businessId && pageType) {
      fetchColorConfig();
    }
  }, [businessId, pageType]);

  const fetchColorConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/business/color-config?businessId=${businessId}&pageType=${pageType}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        setColors(defaultColors);
        return;
      }

      const data = await response.json();
      if (data.config) {
        setColors({
          backgroundColor: data.config.background_color || defaultColors.backgroundColor,
          textColor: data.config.text_color || defaultColors.textColor,
          buttonColor: data.config.button_color || defaultColors.buttonColor,
          buttonTextColor: data.config.button_text_color || defaultColors.buttonTextColor,
          headerColor: data.config.header_color || defaultColors.headerColor,
          headerTextColor: data.config.header_text_color || defaultColors.headerTextColor,
          accentColor: data.config.accent_color || defaultColors.accentColor,
        });
      } else {
        setColors(defaultColors);
      }
    } catch (err) {
      console.error('Error fetching color config:', err);
      setError('Failed to load preview');
      setColors(defaultColors);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Preview Page</h1>
          <p className="text-sm text-muted-foreground">{pageTypeMap[pageType] || pageType}</p>
        </div>
        <Link href={`/dashboard/menu/customize?businessId=${businessId}`}>
          <Button variant="outline" className="text-xs h-9">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back to Customize
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <div 
          className="border-2 border-dashed border-border rounded-lg overflow-hidden"
          style={{ backgroundColor: colors.backgroundColor }}
        >
          {/* Header */}
          <div 
            style={{ backgroundColor: colors.headerColor }}
            className="p-4 border-b-2 border-gray-200"
          >
            <h2 
              style={{ color: colors.headerTextColor }}
              className="text-xl font-bold"
            >
              Restaurant Menu Preview
            </h2>
            <p style={{ color: colors.headerTextColor }} className="text-xs opacity-75 mt-1">
              This is how your customers will see the page with your selected colors
            </p>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {/* Sample Category Section */}
            <div className="mb-8">
              <h3 
                style={{ color: colors.textColor }}
                className="text-lg font-semibold mb-4"
              >
                Sample Category
              </h3>

              {/* Sample Menu Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i}
                    style={{ 
                      backgroundColor: colors.headerColor,
                      borderColor: colors.accentColor 
                    }}
                    className="p-4 rounded border-2"
                  >
                    {/* Image Placeholder */}
                    <div 
                      style={{ backgroundColor: colors.accentColor + '20' }}
                      className="h-32 rounded mb-3 flex items-center justify-center"
                    >
                      <span style={{ color: colors.textColor }} className="text-xs">
                        Image Placeholder
                      </span>
                    </div>

                    {/* Item Name */}
                    <h4 
                      style={{ color: colors.textColor }}
                      className="font-semibold mb-2"
                    >
                      Sample Dish {i}
                    </h4>

                    {/* Item Description */}
                    <p 
                      style={{ color: colors.textColor }}
                      className="text-xs mb-3 opacity-75 line-clamp-2"
                    >
                      This is a sample description of the dish with your custom colors
                    </p>

                    {/* Price */}
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ color: colors.accentColor }} className="font-bold">
                        ₦2,500
                      </span>
                    </div>

                    {/* Action Button */}
                    <button
                      style={{ 
                        backgroundColor: colors.buttonColor,
                        color: colors.buttonTextColor 
                      }}
                      className="w-full py-2 rounded font-medium text-xs hover:opacity-90 transition-opacity"
                    >
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Drinks Section */}
            <div className="mb-8">
              <h3 
                style={{ color: colors.textColor }}
                className="text-lg font-semibold mb-4"
              >
                Drinks & Beverages
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="text-center">
                    <div 
                      style={{ backgroundColor: colors.accentColor + '20' }}
                      className="h-24 rounded mb-2 flex items-center justify-center"
                    >
                      <span style={{ color: colors.textColor }} className="text-xs">
                        Drink {i}
                      </span>
                    </div>
                    <p 
                      style={{ color: colors.textColor }}
                      className="text-xs font-medium mb-2"
                    >
                      Beverage {i}
                    </p>
                    <p style={{ color: colors.accentColor }} className="text-xs font-bold">
                      ₦1,000
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Call-to-Action Section */}
            <div 
              style={{ backgroundColor: colors.accentColor + '15' }}
              className="p-6 rounded-lg text-center"
            >
              <h3 
                style={{ color: colors.textColor }}
                className="text-lg font-semibold mb-3"
              >
                Ready to Order?
              </h3>
              <button
                style={{ 
                  backgroundColor: colors.buttonColor,
                  color: colors.buttonTextColor 
                }}
                className="px-6 py-3 rounded font-medium hover:opacity-90 transition-opacity"
              >
                View Cart & Checkout
              </button>
            </div>
          </div>

          {/* Footer */}
          <div 
            style={{ backgroundColor: colors.headerColor }}
            className="p-4 border-t-2 border-gray-200 text-center"
          >
            <p style={{ color: colors.headerTextColor }} className="text-xs opacity-75">
              This is a preview of how your page will look to customers
            </p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-blue-700 text-xs">
        <p className="font-medium mb-2">Preview Information:</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li>This preview shows how your selected colors will appear</li>
          <li>Colors are not yet saved. Go back to customize page to save</li>
          <li>The actual page may have different layouts depending on menu content</li>
          <li>Preview updates automatically when you adjust colors</li>
        </ul>
      </div>
    </div>
  );
}
