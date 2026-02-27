'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

interface Addon {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface ItemConfigModalProps {
  item: {
    id: string;
    name: string;
    price: number;
    description?: string;
  };
  addons: Addon[];
  onClose: () => void;
  onAddToCart: (config: any) => void;
}

export function ItemConfigModal({
  item,
  addons,
  onClose,
  onAddToCart,
}: ItemConfigModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const addonsByCategory = addons.reduce((acc, addon) => {
    if (!acc[addon.category]) acc[addon.category] = [];
    acc[addon.category].push(addon);
    return acc;
  }, {} as Record<string, Addon[]>);

  const addonsTotal = addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);

  const totalPrice = (item.price + addonsTotal) * quantity;

  const handleAddToCart = () => {
    onAddToCart({
      itemId: item.id,
      quantity,
      selectedAddons,
      totalPrice,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-background w-full max-w-md rounded-t-lg sm:rounded-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="font-bold text-sm">{item.name}</h2>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            )}
            <p className="font-semibold text-primary mt-2">₦{item.price.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Addons Selection */}
        <div className="p-4 space-y-4">
          {Object.entries(addonsByCategory).map(([category, categoryAddons]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryAddons.map((addon) => (
                  <label
                    key={addon.id}
                    className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-primary/5"
                  >
                    <Checkbox
                      checked={selectedAddons.includes(addon.id)}
                      onCheckedChange={(checked) => {
                        setSelectedAddons((prev) =>
                          checked ? [...prev, addon.id] : prev.filter((id) => id !== addon.id)
                        );
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 flex justify-between text-xs">
                      <span>{addon.name}</span>
                      <span className="text-muted-foreground">+₦{addon.price.toLocaleString()}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quantity & Total */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4 space-y-3">
          <div className="flex items-center gap-3 justify-between">
            <span className="text-xs text-muted-foreground">Quantity:</span>
            <div className="flex items-center gap-2 border border-border rounded">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-2 py-1 text-sm font-bold hover:bg-muted"
              >
                −
              </button>
              <span className="px-3 text-sm font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-2 py-1 text-sm font-bold hover:bg-muted"
              >
                +
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            {addonsTotal > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Addons:</span>
                <span>+₦{(addonsTotal * quantity).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm">
              <span>Total:</span>
              <span className="text-primary">₦{totalPrice.toLocaleString()}</span>
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium"
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
