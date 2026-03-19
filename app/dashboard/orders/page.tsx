'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, CheckCircle, AlertTriangle, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, parseISO, startOfDay, endOfDay, isSameDay } from 'date-fns';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  business_name: string;
  menu_items?: Array<{
    name: string;
    quantity: number;
  }>;
}

interface GroupedOrders {
  [date: string]: Order[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isMobile = useIsMobile();
  const dateContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const fetchOrders = useCallback(async () => {

    useEffect(() => {
      fetchOrders();
    }, [fetchOrders]);

    try {
      const response = await fetch('/api/business/orders', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data);
      setError('');
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Group orders by date
  useEffect(() => {
    const grouped: GroupedOrders = {};

    orders.forEach((order) => {
      const dateKey = format(parseISO(order.created_at), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(order);
    });

    // Sort dates in descending order
    const sortedGrouped = Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .reduce((acc, date) => {
        acc[date] = grouped[date];
        return acc;
      }, {} as GroupedOrders);

    setGroupedOrders(sortedGrouped);

    // Set initial selected date if not set
    if (!selectedDate && Object.keys(sortedGrouped).length > 0) {
      setSelectedDate(Object.keys(sortedGrouped)[0]);
    }
  }, [orders, selectedDate]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getDayOrders = (date: string) => groupedOrders[date] || [];

  const getDaySummary = (date: string) => {
    const dayOrders = getDayOrders(date);
    const totalRevenue = dayOrders.reduce((sum, order) => sum + order.total_amount, 0);
    return {
      count: dayOrders.length,
      revenue: totalRevenue,
    };
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    // Scroll to the selected date section
    setTimeout(() => {
      sectionRefs.current[date]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const dates = Object.keys(groupedOrders);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Orders</h1>
          <p className="text-xs text-muted-foreground">View and manage incoming customer orders</p>
        </div>
        <div className="text-center py-8">
          <Clock className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Orders</h1>
          <p className="text-xs text-muted-foreground">View and manage incoming customer orders</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Orders</h1>
        <p className="text-xs text-muted-foreground">View and manage incoming customer orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-border rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">No orders yet</p>
          <p className="text-xs text-muted-foreground">
            Share your restaurant with customers to start receiving orders
          </p>
        </div>
      ) : (
        <>
          {/* Date Picker */}
          <div className="relative" ref={dateContainerRef}>
            <Button
              variant="outline"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-xs"
            >
              {selectedDate ? format(parseISO(selectedDate), 'MMM dd, yyyy') : 'Select Date'}
            </Button>

            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-border rounded-lg shadow-lg p-3 z-10 max-h-64 overflow-y-auto">
                <div className="space-y-1">
                  {dates.map((date) => {
                    const summary = getDaySummary(date);
                    return (
                      <button
                        key={date}
                        onClick={() => handleDateSelect(date)}
                        className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${selectedDate === date
                          ? 'bg-blue-100 text-blue-900'
                          : 'hover:bg-gray-100'
                          }`}
                      >
                        <div className="font-medium">{format(parseISO(date), 'MMM dd, yyyy')}</div>
                        <div className="text-muted-foreground text-xs">
                          {summary.count} orders • {formatCurrency(summary.revenue)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Orders grouped by date */}
          <div className="space-y-6">
            {dates.map((date) => {
              const dayOrders = getDayOrders(date);
              const summary = getDaySummary(date);

              return (
                <div
                  key={date}
                  ref={(el) => {
                    if (el) sectionRefs.current[date] = el;
                  }}
                  className="scroll-mt-20"
                >
                  {/* Sticky Date Header */}
                  <div className="sticky top-0 bg-white/95 backdrop-blur z-10 px-4 py-2 border-b border-border -mx-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold">
                          {format(parseISO(date), 'EEEE, MMM dd yyyy')}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {summary.count} orders • Total: {formatCurrency(summary.revenue)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Orders for this date */}
                  {isMobile ? (
                    // Mobile Card Layout
                    <div className="space-y-3 mt-4">
                      {dayOrders.map((order) => (
                        <Link
                          key={order.id}
                          href={`/dashboard/orders/${order.id}`}
                          className="block bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-gray-900">{order.customer_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Order #{order.id.slice(0, 8)}</p>
                            </div>
                            {getStatusIcon(order.status)}
                          </div>

                          <div className="space-y-2 mb-3">
                            <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{order.address}</p>

                            {/* Menu Items Preview */}
                            {order.menu_items && order.menu_items.length > 0 && (
                              <div className="pt-2 space-y-1 border-t border-border">
                                {order.menu_items.slice(0, 2).map((item, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    • {item.name} {item.quantity > 1 && `(x${item.quantity})`}
                                  </p>
                                ))}
                                {order.menu_items.length > 2 && (
                                  <p className="text-xs text-muted-foreground italic">
                                    +{order.menu_items.length - 2} more
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-border">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium capitalize ${order.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : order.payment_status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                                }`}
                            >
                              {order.payment_status}
                            </span>
                            <p className="font-semibold text-sm">{formatCurrency(order.total_amount)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    // Desktop Table Layout
                    <div className="bg-white border border-border rounded-lg overflow-hidden mt-4">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-border">
                          <tr>
                            <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">
                              Customer
                            </th>
                            <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">
                              Items
                            </th>
                            <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">
                              Payment
                            </th>
                            <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">
                              Order Status
                            </th>
                            <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">
                              Amount
                            </th>
                            <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {dayOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-semibold text-sm">{order.customer_name}</p>
                                <p className="text-xs text-muted-foreground">#{order.id.slice(0, 8)}</p>
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {order.menu_items && order.menu_items.length > 0 ? (
                                  <div className="space-y-1">
                                    {order.menu_items.slice(0, 2).map((item, idx) => (
                                      <div key={idx} className="text-xs">
                                        {item.name} {item.quantity > 1 && `(x${item.quantity})`}
                                      </div>
                                    ))}
                                    {order.menu_items.length > 2 && (
                                      <div className="text-xs italic text-muted-foreground">
                                        +{order.menu_items.length - 2} more
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium capitalize ${order.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : order.payment_status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                  {order.payment_status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium capitalize flex items-center gap-1 w-fit ${getStatusColor(order.status)}`}
                                >
                                  {getStatusIcon(order.status)} {order.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-semibold text-sm">
                                {formatCurrency(order.total_amount)}
                              </td>
                              <td className="px-6 py-4">
                                <Link href={`/dashboard/orders/${order.id}`}>
                                  <Button variant="outline" size="sm" className="text-xs h-8">
                                    View Details
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
