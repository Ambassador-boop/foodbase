'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

interface AddonOption {
  id: string;
  name: string;
  price: number;
}

interface Addon {
  id: string;
  name: string;
  description?: string;
  is_required: boolean;
  addon_type: string;
  options: AddonOption[];
}

interface AddonSelectionModalProps {
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

export function AddonSelectionModal({
  item,
  addons,
  onClose,
  onAddToCart,
}: AddonSelectionModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string | string[]>>({});

  // Calculate total price
  let addonsTotal = 0;
  addons.forEach((addon) => {
    const selected = selectedAddons[addon.id];
    if (selected) {
      if (Array.isArray(selected)) {
        // Multiple selections
        selected.forEach((optionId) => {
          const option = addon.options.find((o) => o.id === optionId);
          if (option) addonsTotal += option.price;
        });
      } else {
        // Single selection
        const option = addon.options.find((o) => o.id === selected);
        if (option) addonsTotal += option.price;
      }
    }
  });

  const totalPrice = (item.price + addonsTotal) * quantity;

  const handleOptionSelect = (addonId: string, optionId: string, allowMultiple: boolean) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId];
      if (allowMultiple) {
        // Multiple selections allowed
        if (Array.isArray(current)) {
          return {
            ...prev,
            [addonId]: current.includes(optionId)
              ? current.filter((id) => id !== optionId)
              : [...current, optionId],
          };
        } else {
          return {
            ...prev,
            [addonId]: [optionId],
          };
        }
      } else {
        // Single selection
        return {
          ...prev,
          [addonId]: current === optionId ? undefined : optionId,
        };
      }
    });
  };

  const handleAddToCart = () => {
    // Validate required addons
    for (const addon of addons) {
      if (addon.is_required && !selectedAddons[addon.id]) {
        alert(`${addon.name} is required`);
        return;
      }
    }

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
          {addons.length === 0 ? (
            <p className="text-xs text-muted-foreground">No add-ons available for this item</p>
          ) : (
            addons.map((addon) => (
              <div key={addon.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {addon.name}
                  </h3>
                  {addon.is_required && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      Required
                    </span>
                  )}
                </div>
                {addon.description && (
                  <p className="text-xs text-muted-foreground mb-2">{addon.description}</p>
                )}
                <div className="space-y-1">
                  {addon.options.map((option) => {
                    const selected = Array.isArray(selectedAddons[addon.id])
                      ? (selectedAddons[addon.id] as string[]).includes(option.id)
                      : selectedAddons[addon.id] === option.id;

                    return (
                      <label
                        key={option.id}
                        className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted"
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() =>
                            handleOptionSelect(addon.id, option.id, addon.allow_multiple || false)
                          }
                          className="w-4 h-4"
                        />
                        <div className="flex-1 flex justify-between text-xs">
                          <span>{option.name}</span>
                          {option.price > 0 && (
                            <span className="text-muted-foreground">+₦{option.price.toLocaleString()}</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
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
                <span>Add-ons:</span>
                <span>+₦{(addonsTotal * quantity).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm">
              <span>Total:</span>
              <span className="text-primary">₦{totalPrice.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAddToCart}
              className="flex-1 h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium"
            >
              Add to Cart
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-9 text-sm font-medium"
            >
              Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
