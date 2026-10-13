'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle, Save, Eye } from 'lucide-react';

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
  buttonColor: '#F26A21',
  buttonTextColor: '#ffffff',
  headerColor: '#ffffff',
  headerTextColor: '#1a1a1a',
  accentColor: '#6b8e23',
};

const pageTypes = [
  { id: 'menu', label: 'Menu Page' },
  { id: 'add_on', label: 'Add-ons Page' },
  { id: 'cart', label: 'Cart Page' },
  { id: 'checkout', label: 'Checkout Page' },
  { id: 'receipt', label: 'Receipt Page' },
];

const colorFields = [
  { key: 'backgroundColor', label: 'Background Color' },
  { key: 'textColor', label: 'Text Color' },
  { key: 'buttonColor', label: 'Button Color' },
  { key: 'buttonTextColor', label: 'Button Text Color' },
  { key: 'headerColor', label: 'Header Color' },
  { key: 'headerTextColor', label: 'Header Text Color' },
  { key: 'accentColor', label: 'Accent Color' },
];

export default function CustomizeMenuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businessId, setBusinessId] = useState<string>('');

  const [selectedPageType, setSelectedPageType] = useState('menu');
  const [colors, setColors] = useState<ColorConfig>(defaultColors);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get businessId from server-side resolution
  useEffect(() => {
    const urlBusinessId = searchParams.get('businessId');
    if (urlBusinessId) {
      setBusinessId(urlBusinessId);
    } else {
      // Fetch current active business from server
      fetchCurrentBusiness();
    }
  }, [searchParams]);

  const fetchCurrentBusiness = async () => {
    try {
      const response = await fetch('/api/user/current-business', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.businessId) {
          setBusinessId(data.businessId);
        }
      }
    } catch (err) {
      console.error('Error fetching current business:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      fetchColorConfig();
    } else {
      setLoading(false);
    }
  }, [businessId, selectedPageType]);

  const fetchColorConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/business/color-config?businessId=${businessId}&pageType=${selectedPageType}`,
        { credentials: 'include' }
      );

      if (!response.ok) throw new Error('Failed to fetch colors');

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
      setColors(defaultColors);
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = (field: string, value: string) => {
    setColors(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveColors = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/business/color-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          businessId,
          pageType: selectedPageType,
          backgroundColor: colors.backgroundColor,
          textColor: colors.textColor,
          buttonColor: colors.buttonColor,
          buttonTextColor: colors.buttonTextColor,
          headerColor: colors.headerColor,
          headerTextColor: colors.headerTextColor,
          accentColor: colors.accentColor,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save colors');
      }

      setSuccess('Colors saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving colors:', err);
      setError('Failed to save colors');
    } finally {
      setSaving(false);
    }
  };

  const handleResetColors = () => {
    setColors(defaultColors);
  };

  const handlePreview = () => {
    router.push(`/dashboard/menu/customize/preview?businessId=${businessId}&pageType=${selectedPageType}`);
  };

  if (!businessId) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Business ID is required to customize menu colors</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Customize Menu Colors</h1>
        <p className="text-sm text-muted-foreground">Choose colors for your restaurant&apos;s pages</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Page Selection Sidebar */}
        <Card className="p-4 h-fit">
          <Label className="text-xs font-semibold text-foreground mb-3 block">Select Page</Label>
          <div className="space-y-2">
            {pageTypes.map(pageType => (
              <button
                key={pageType.id}
                onClick={() => setSelectedPageType(pageType.id)}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${selectedPageType === pageType.id
                    ? 'bg-primary text-white'
                    : 'bg-muted/30 text-foreground hover:bg-muted/50'
                  }`}
              >
                {pageType.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Color Configuration */}
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">Loading colors...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {colorFields.map(field => (
                  <Card key={field.key} className="p-4">
                    <Label className="text-xs font-semibold text-foreground mb-2 block">
                      {field.label}
                    </Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={colors[field.key as keyof ColorConfig] || '#000000'}
                        onChange={(e) => handleColorChange(field.key, e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer border border-border"
                      />
                      <input
                        type="text"
                        value={colors[field.key as keyof ColorConfig] || '#000000'}
                        onChange={(e) => handleColorChange(field.key, e.target.value)}
                        className="flex-1 px-3 py-2 rounded border border-border text-xs font-mono"
                        placeholder="#000000"
                      />
                    </div>
                  </Card>
                ))}
              </div>

              {/* Preview Box */}
              <Card className="p-6 mt-6" style={{ backgroundColor: colors.backgroundColor }}>
                <div style={{ color: colors.headerTextColor }}>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ backgroundColor: colors.headerColor, color: colors.headerTextColor, padding: '12px', borderRadius: '4px' }}
                  >
                    Preview
                  </h3>
                  <p style={{ color: colors.textColor }} className="text-sm mb-4">
                    This is how your page will look with the selected colors
                  </p>
                  <button
                    style={{ backgroundColor: colors.buttonColor, color: colors.buttonTextColor }}
                    className="px-4 py-2 rounded text-sm font-medium"
                  >
                    Sample Button
                  </button>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-between pt-4">
                <Button
                  onClick={handleResetColors}
                  variant="outline"
                  className="text-xs h-9"
                >
                  Reset to Default
                </Button>
                <div className="flex gap-3">
                  <Button
                    onClick={handlePreview}
                    variant="outline"
                    className="text-xs h-9"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Preview Page
                  </Button>
                  <Button
                    onClick={handleSaveColors}
                    disabled={saving}
                    className="text-xs h-9 bg-primary text-white hover:bg-primary-dark"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {saving ? 'Saving...' : 'Save Colors'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
