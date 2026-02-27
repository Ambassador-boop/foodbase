'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, AlertCircle } from 'lucide-react';

export default function DrinksPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
  });
  const [drinks, setDrinks] = useState([]);
  const [error, setError] = useState('');

  const handleAddDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.price) {
      setError('Name and price are required');
      return;
    }

    try {
      const response = await fetch('/api/business/drinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add drink');
        return;
      }

      setDrinks([data.drink, ...drinks]);
      setFormData({ name: '', description: '', price: '' });
      setShowForm(false);
    } catch (err) {
      setError('An error occurred');
      console.error(err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Drinks</h1>
          <p className="text-xs text-muted-foreground">Manage beverages and drinks</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="w-4 h-4 mr-1" />
          Drink
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Add New Drink</h2>
            <button onClick={() => setShowForm(false)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddDrink} className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Drink Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Coca Cola"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-semibold">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the drink..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 text-xs min-h-12"
              />
            </div>

            <div>
              <Label htmlFor="price" className="text-xs font-semibold">
                Price (NGN)
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

            <Button type="submit" className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Add Drink
            </Button>
          </form>
        </div>
      )}

      {/* Drinks List */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {drinks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No drinks added yet. Add your first drink!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {drinks.map((drink: any) => (
                  <tr key={drink.id} className="hover:bg-muted/5">
                    <td className="px-3 py-2 font-medium">{drink.name}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(drink.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
