'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    platformFee: '2.5',
    minimumOrder: '1000',
    supportEmail: 'support@foodbase.app',
    paystackPublicKey: '',
  });

  const handleSave = async () => {
    // Save settings API call would go here
    alert('Settings saved successfully');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold mb-1">Platform Settings</h1>
        <p className="text-xs text-muted-foreground">Configure FoodBase platform settings</p>
      </div>

      <div className="bg-white border border-border rounded-lg p-4 space-y-4">
        <div>
          <Label className="text-xs font-semibold">Platform Commission Fee (%)</Label>
          <Input
            type="number"
            step="0.1"
            value={settings.platformFee}
            onChange={(e) => setSettings({ ...settings, platformFee: e.target.value })}
            className="mt-1 h-8 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Percentage taken from each transaction (default: 2.5%)
          </p>
        </div>

        <div>
          <Label className="text-xs font-semibold">Minimum Order Amount (NGN)</Label>
          <Input
            type="number"
            value={settings.minimumOrder}
            onChange={(e) => setSettings({ ...settings, minimumOrder: e.target.value })}
            className="mt-1 h-8 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Minimum order value customers can place
          </p>
        </div>

        <div>
          <Label className="text-xs font-semibold">Support Email</Label>
          <Input
            type="email"
            value={settings.supportEmail}
            onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
            className="mt-1 h-8 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold">Paystack Public Key</Label>
          <Input
            type="password"
            placeholder="pk_live_..."
            value={settings.paystackPublicKey}
            onChange={(e) => setSettings({ ...settings, paystackPublicKey: e.target.value })}
            className="mt-1 h-8 text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Used for payment processing
          </p>
        </div>

        <Button
          onClick={handleSave}
          className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          Save Settings
        </Button>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold">System Information</h2>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Platform Version:</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Database:</span>
            <span className="font-medium">Neon PostgreSQL</span>
          </div>
          <div className="flex justify-between">
            <span>Payment Provider:</span>
            <span className="font-medium">Paystack</span>
          </div>
        </div>
      </div>
    </div>
  );
}
