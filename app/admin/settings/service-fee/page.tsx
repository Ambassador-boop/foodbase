'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ServiceFeeConfig {
  id: string;
  tier_value: number;
  service_fee: number;
}

export default function ServiceFeeConfigPage() {
  const [tiers, setTiers] = useState<ServiceFeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/service-fee');
      const data = await response.json();
      setTiers(data);
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('Failed to load service fee configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = (index: number, field: 'tier_value' | 'service_fee', value: string) => {
    const newTiers = [...tiers];
    newTiers[index] = {
      ...newTiers[index],
      [field]: parseInt(value) || 0,
    };
    setTiers(newTiers);
  };

  const addTier = () => {
    setTiers([
      ...tiers,
      {
        id: `tier-${Date.now()}`,
        tier_value: 0,
        service_fee: 0,
      },
    ]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (tiers.length === 0) {
      setError('At least one tier is required');
      return;
    }

    // Validate all tiers
    for (const tier of tiers) {
      if (tier.tier_value <= 0 || tier.service_fee <= 0) {
        setError('All tier values and service fees must be greater than 0');
        return;
      }
    }

    // Check for duplicates
    const uniqueTiers = new Set(tiers.map((t) => t.tier_value));
    if (uniqueTiers.size !== tiers.length) {
      setError('Tier values must be unique');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/service-fee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tiers }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save configuration');
        return;
      }

      setSuccess('Service fee configuration updated successfully');
      fetchConfig();
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/settings">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Service Fee Configuration</h1>
          <p className="text-xs text-muted-foreground">Configure tiered service fees for orders</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-800">{success}</p>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-4">
          {tiers.map((tier, index) => (
            <div key={index} className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-xs font-semibold">Min Order Amount (₦)</Label>
                <Input
                  type="number"
                  value={tier.tier_value}
                  onChange={(e) => handleTierChange(index, 'tier_value', e.target.value)}
                  placeholder="e.g., 1000"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs font-semibold">Service Fee (₦)</Label>
                <Input
                  type="number"
                  value={tier.service_fee}
                  onChange={(e) => handleTierChange(index, 'service_fee', e.target.value)}
                  placeholder="e.g., 100"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => removeTier(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add Tier Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-2"
          onClick={addTier}
        >
          <Plus className="w-4 h-4" />
          Add Tier
        </Button>

        {/* Info Box */}
        <div className="bg-primary/5 border border-primary/20 rounded p-3 space-y-2">
          <p className="text-xs font-semibold">How it works:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Tiers are matched based on order subtotal</li>
            <li>For amounts above 30,000: service fee increases by ₦100 per ₦10,000</li>
            <li>Lowest matching tier applies to each order</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
        <Link href="/admin/settings" className="flex-1">
          <Button variant="outline" className="w-full h-8 text-xs">
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  );
}
