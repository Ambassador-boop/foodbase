'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, CheckCircle, ArrowLeft, ChevronDown } from 'lucide-react';

interface OrderItem {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  menu_item_description?: string;
  menu_item_image?: string;
  quantity: number;
  item_price: number;
  addons: Array<{
    id: string;
    name: string;
    price: number;
    image_url?: string;
  }>;
}

interface OrderData {
  order: {
    id: string;
    business_id: string;
    business_name: string;
    logo_url?: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    address: string;
    status: string;
    payment_status: string;
    notes?: string;
    created_at: string;
    completed_at?: string;
  };
  items: OrderItem[];
  calculations: {
    subtotal: number;
    serviceFee: number;
    total: number;
  };
}

const statuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  useEffect(() => {
    fetchOrderData();
  }, [orderId]);

  const fetchOrderData = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error('Failed to fetch order');

      const data = await response.json();
      setOrderData(data);
      setSelectedStatus(data.order.status);
      setError('');
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (newStatus === orderData?.order.status) return;

    setUpdating(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      const responseData = await response.json();

      setOrderData((prev) =>
        prev ? { ...prev, order: { ...prev.order, status: newStatus } } : null
      );
      setSelectedStatus(newStatus);
    } catch (err) {
      console.error('Error updating status:', err);
      alert(`Failed to update order status: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSelectedStatus(orderData?.order.status || '');
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const getAddonQuantity = (addons: OrderItem['addons'], addonId: string): number => {
    return addons.filter((a) => a.id === addonId).length;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/orders">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
        <div className="text-center py-8">
          <Clock className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/orders">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const estimatedTime = new Date(new Date(orderData.order.created_at).getTime() + 30 * 60000);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/orders">
        <Button variant="outline" size="sm" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
      </Link>

      {/* Order Header */}
      <div className="bg-white border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Order Number</p>
            <p className="text-2xl font-bold font-mono">{orderData.order.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Restaurant</p>
            <p className="text-lg font-semibold">{orderData.order.business_name}</p>
          </div>
        </div>

        {/* Status Update Section - Dropdown */}
        <div className="space-y-3 mb-6 pb-6 border-b border-border">
          <label className="block text-sm font-semibold">Update Order Status</label>
          <div className="relative">
            <div className="relative inline-block w-full sm:w-auto">
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusUpdate(e.target.value)}
                disabled={updating}
                className="appearance-none px-4 py-2 pr-10 border border-border rounded-lg text-sm font-medium bg-white cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {statuses.map((status) => (
                  <option key={status} value={status} className="capitalize">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
            </div>
          </div>
          {updating && (
            <p className="text-xs text-blue-600 animate-pulse">Updating status...</p>
          )}
        </div>

        {/* Order Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground mb-1">Status</p>
            <p className="font-semibold capitalize bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block">
              {orderData.order.status}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Payment Status</p>
            <p className="font-semibold capitalize bg-green-100 text-green-800 px-2 py-1 rounded inline-block">
              {orderData.order.payment_status}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Estimated Ready</p>
            <p className="font-semibold">
              {estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Order Items</h2>
        <div className="space-y-4">
          {orderData.items.map((item, idx) => {
            const hasAddons = item.addons && item.addons.length > 0;
            const perUnitPrice = item.item_price / item.quantity;
            const addonsTotal = item.addons?.reduce((sum, addon) => sum + addon.price, 0) || 0;

            return (
              <div key={idx} className="border border-border rounded p-4">
                {/* Menu Item */}
                <div className="flex gap-3 mb-3">
                  {item.menu_item_image && (
                    <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                      <Image
                        src={item.menu_item_image}
                        alt={item.menu_item_name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{item.menu_item_name}</h3>
                    {item.menu_item_description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.menu_item_description}</p>
                    )}
                    <div className="flex justify-between items-end mt-1">
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      <p className="text-xs font-semibold">
                        {formatCurrency(perUnitPrice)} {item.quantity > 1 && `× ${item.quantity}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Addons */}
                {hasAddons && (
                  <div className="ml-3 space-y-2 border-l-2 border-border pl-3">
                    <p className="text-xs font-medium text-muted-foreground">Add-ons:</p>
                    {Array.from(new Set(item.addons.map((a) => a.id))).map((addonId) => {
                      const addon = item.addons.find((a) => a.id === addonId);
                      const quantity = getAddonQuantity(item.addons, addonId);
                      if (!addon) return null;

                      return (
                        <div key={addonId} className="space-y-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-xs">
                                {addon.name}
                                {quantity > 1 && <span className="text-muted-foreground ml-1">× {quantity}</span>}
                              </p>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">
                              +{formatCurrency(addon.price * quantity)}
                            </p>
                          </div>
                          {addon.image_url && (
                            <div className="relative w-12 h-12 rounded overflow-hidden mt-1">
                              <Image
                                src={addon.image_url}
                                alt={addon.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Item Total */}
                <div className="flex justify-between pt-2 border-t border-border mt-2">
                  <span className="text-xs font-semibold">Item Total:</span>
                  <span className="text-xs font-bold">
                    {formatCurrency((perUnitPrice + addonsTotal) * item.quantity)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="bg-white border border-border rounded-lg p-6 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal:</span>
          <span>{formatCurrency(orderData.calculations.subtotal)}</span>
        </div>
        <div className="flex justify-between pb-2 border-b border-border">
          <span className="text-muted-foreground">Service Fee (7.5%):</span>
          <span>+{formatCurrency(orderData.calculations.serviceFee)}</span>
        </div>
        <div className="flex justify-between font-semibold text-sm">
          <span>Total Paid:</span>
          <span className="text-primary">{formatCurrency(orderData.calculations.total)}</span>
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Name</p>
            <p className="font-semibold">{orderData.order.customer_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Phone</p>
            <p className="font-semibold">{orderData.order.customer_phone}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground mb-1">Email</p>
            <p className="font-semibold">{orderData.order.customer_email}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground mb-1">Delivery Address</p>
            <p className="font-semibold">{orderData.order.address}</p>
          </div>
          {orderData.order.notes && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground mb-1">Special Instructions</p>
              <p className="font-semibold">{orderData.order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
