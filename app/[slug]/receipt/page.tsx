'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  AlertCircle,
  Share2,
  FileImage,
  FileText,
  Calendar,
  Hash,
  Mail,
  ShoppingBag,
  ArrowLeft,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { fetchColorConfig, type ColorConfig } from '@/lib/color-config';

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

const PUBLIC_BASE_URL = 'https://myfoodbase.vercel.app';

export default function ReceiptPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [colors, setColors] = useState<ColorConfig | null>(null);
  const [downloading, setDownloading] = useState<null | 'pdf' | 'png'>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Fetch order
  useEffect(() => {
    if (!orderId) {
      setError('Order ID not found');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch order');
        }
        const data = await response.json();
        if (!cancelled) setOrderData(data);
      } catch (err) {
        console.error('Receipt: error fetching order', err);
        if (!cancelled) setError('Failed to load order details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Fetch theme colors once we have a business_id
  useEffect(() => {
    const businessId = orderData?.order.business_id;
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await fetchColorConfig(businessId);
        if (!cancelled) setColors(c);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderData?.order.business_id]);

  const formatCurrency = (amount: number) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(num);
  };

  const orderDateLabel = useMemo(() => {
    if (!orderData?.order.created_at) return { date: '', time: '' };
    const d = new Date(orderData.order.created_at);
    return {
      date: d.toLocaleDateString('en-NG', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: d.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    };
  }, [orderData?.order.created_at]);

  const qrUrl = useMemo(() => `${PUBLIC_BASE_URL}/${slug}`, [slug]);

  const accent = colors?.buttonColor || '#0f172a';
  const accentText = colors?.buttonTextColor || '#ffffff';

  // ---------- Share / download ----------
  const captureCanvas = async () => {
    if (!receiptRef.current) return null;
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas(receiptRef.current, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
  };

  const handleDownloadPNG = async () => {
    try {
      setDownloading('png');
      const canvas = await captureCanvas();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `receipt-${orderData?.order.id || 'order'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShareOpen(false);
    } catch (err) {
      console.error('PNG download failed', err);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading('pdf');
      const canvas = await captureCanvas();
      if (!canvas) return;
      const { jsPDF } = await import('jspdf');
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // If image fits on a single page, just add it; else paginate.
      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      } else {
        let position = margin;
        let heightLeft = imgHeight;
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= pageHeight - margin * 2;
        }
      }
      pdf.save(`receipt-${orderData?.order.id || 'order'}.pdf`);
      setShareOpen(false);
    } catch (err) {
      console.error('PDF download failed', err);
    } finally {
      setDownloading(null);
    }
  };

  // ---------- Render states ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{error || 'Order not found'}</p>
          <Link href={slug ? `/${slug}` : '/'}>
            <Button>Back to Menu</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-24 lg:pb-12"
      style={{ backgroundColor: '#f6f7f9' }}
    >
      {/* Top action bar */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link
            href={slug ? `/${slug}` : '/'}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80"
            aria-label="Back to menu"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to menu</span>
          </Link>

          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                className="h-9 gap-2 font-medium"
                style={{ backgroundColor: accent, color: accentText }}
              >
                <Share2 className="w-4 h-4" />
                Share receipt
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1.5">
              <button
                onClick={handleDownloadPDF}
                disabled={downloading !== null}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                  >
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="flex flex-col text-left">
                    <span className="font-medium leading-tight">Download PDF</span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      A4 size, printable
                    </span>
                  </span>
                </span>
                {downloading === 'pdf' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              <button
                onClick={handleDownloadPNG}
                disabled={downloading !== null}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                  >
                    <FileImage className="w-4 h-4" />
                  </span>
                  <span className="flex flex-col text-left">
                    <span className="font-medium leading-tight">Download PNG</span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      Image, easy to share
                    </span>
                  </span>
                </span>
                {downloading === 'png' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Confirmation hero */}
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3"
            style={{ backgroundColor: `${accent}1A`, color: accent }}
          >
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
            Order confirmed
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Thanks{orderData.order.customer_name ? `, ${orderData.order.customer_name.split(' ')[0]}` : ''}! A copy of this receipt is saved here.
          </p>
        </div>

        {/* The capturable receipt card */}
        <ReceiptDocument
          ref={receiptRef}
          data={orderData}
          formatCurrency={formatCurrency}
          orderDateLabel={orderDateLabel}
          accent={accent}
          accentText={accentText}
          qrUrl={qrUrl}
        />

        {/* Bottom action row */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href={slug ? `/${slug}` : '/'} className="w-full">
            <Button variant="outline" className="w-full h-11 font-medium gap-2">
              <ShoppingBag className="w-4 h-4" />
              Continue shopping
            </Button>
          </Link>
          <Button
            onClick={() => setShareOpen(true)}
            className="w-full h-11 font-medium gap-2"
            style={{ backgroundColor: accent, color: accentText }}
          >
            <Share2 className="w-4 h-4" />
            Share receipt
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          A confirmation has been sent to the restaurant. Your order will be ready soon.
        </p>
      </main>
    </div>
  );
}

// -------------- The actual receipt body (also used for PDF/PNG capture) --------------

interface ReceiptDocumentProps {
  data: OrderData;
  formatCurrency: (amount: number) => string;
  orderDateLabel: { date: string; time: string };
  accent: string;
  accentText: string;
  qrUrl: string;
}

const ReceiptDocument = ({
  ref,
  data,
  formatCurrency,
  orderDateLabel,
  accent,
  accentText,
  qrUrl,
}: ReceiptDocumentProps & { ref: React.Ref<HTMLDivElement> }) => {
  const { order, items, calculations } = data;
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <article
      ref={ref}
      className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden"
      style={{ color: '#0f172a' }}
    >
      {/* Banner */}
      <div
        className="px-6 sm:px-8 pt-7 pb-6 text-center"
        style={{
          background: `linear-gradient(180deg, ${accent}0F 0%, transparent 100%)`,
        }}
      >
        {/* Logo */}
        <div className="mx-auto w-20 h-20 rounded-full overflow-hidden bg-white border-2 border-white shadow-md flex items-center justify-center">
          {order.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={order.logo_url}
              alt={`${order.business_name} logo`}
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="text-2xl font-bold"
              style={{ color: accent }}
            >
              {order.business_name?.charAt(0) || '?'}
            </span>
          )}
        </div>

        <p className="text-[11px] tracking-[0.2em] font-semibold uppercase mt-4 text-muted-foreground">
          Order Receipt
        </p>
        <h2 className="text-xl sm:text-2xl font-bold mt-1">
          {order.business_name}
        </h2>
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {order.payment_status === 'paid' ? 'Payment received' : `Payment ${order.payment_status}`}
        </div>
      </div>

      {/* Order meta strip */}
      <div className="px-6 sm:px-8 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-3 py-5 border-y border-dashed border-border bg-muted/40">
        <MetaCell
          icon={<Hash className="w-3.5 h-3.5" />}
          label="Order ID"
          value={
            <span className="font-mono text-sm">
              #{String(order.id).slice(0, 8).toUpperCase()}
            </span>
          }
        />
        <MetaCell
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="Date"
          value={<span className="text-sm font-semibold">{orderDateLabel.date}</span>}
        />
        <MetaCell
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Time"
          value={<span className="text-sm font-semibold">{orderDateLabel.time}</span>}
        />
      </div>

      {/* Items */}
      <section className="px-6 sm:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Items
          </h3>
          <span className="text-xs font-medium text-muted-foreground">
            {totalQty} {totalQty === 1 ? 'item' : 'items'}
          </span>
        </div>

        <ul className="divide-y divide-dashed divide-border">
          {items.map((item, idx) => {
            const perUnit = item.quantity > 0 ? item.item_price / item.quantity : item.item_price;
            const addonPerUnit =
              item.addons?.reduce((sum, a) => sum + Number(a.price || 0), 0) || 0;
            const lineTotal = (perUnit + addonPerUnit) * item.quantity;
            // Deduplicate addons
            const uniqueAddonIds = Array.from(new Set(item.addons.map((a) => a.id)));

            return (
              <li key={idx} className="py-4 first:pt-0 last:pb-0">
                <div className="flex gap-3 sm:gap-4">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {item.menu_item_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.menu_item_image}
                        alt={item.menu_item_name}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5"
                      style={{ backgroundColor: accent, color: accentText }}
                    >
                      {item.quantity}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">
                          {item.menu_item_name}
                        </p>
                        {item.menu_item_description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.menu_item_description}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-bold tabular-nums whitespace-nowrap">
                        {formatCurrency(lineTotal)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {formatCurrency(perUnit + addonPerUnit)} × {item.quantity}
                    </p>

                    {uniqueAddonIds.length > 0 && (
                      <ul
                        className="mt-2 pl-3 border-l-2 space-y-1"
                        style={{ borderColor: `${accent}33` }}
                      >
                        {uniqueAddonIds.map((addonId) => {
                          const addon = item.addons.find((a) => a.id === addonId);
                          if (!addon) return null;
                          const count = item.addons.filter((a) => a.id === addonId).length;
                          return (
                            <li
                              key={addonId}
                              className="flex items-center justify-between text-xs text-muted-foreground"
                            >
                              <span className="truncate">
                                {addon.name}
                                {count > 1 && (
                                  <span className="ml-1 opacity-70">× {count}</span>
                                )}
                              </span>
                              <span className="tabular-nums whitespace-nowrap">
                                +{formatCurrency(Number(addon.price) * count * item.quantity)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Totals */}
      <section className="px-6 sm:px-8 pb-6">
        <div className="rounded-xl bg-muted/40 px-4 py-4 space-y-2 text-sm">
          <Row label="Subtotal" value={formatCurrency(calculations.subtotal)} />
          <Row label="Service Fee" value={`+ ${formatCurrency(calculations.serviceFee)}`} />
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between pt-1">
            <span className="text-base font-semibold">Total paid</span>
            <span
              className="text-lg font-extrabold tabular-nums"
              style={{ color: accent }}
            >
              {formatCurrency(calculations.total)}
            </span>
          </div>
        </div>
      </section>

      {/* Customer info + QR */}
      <section className="px-6 sm:px-8 pb-7 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 sm:gap-8 items-start">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Customer
          </h3>

          <InfoLine
            icon={<ShoppingBag className="w-3.5 h-3.5" />}
            label="Name"
            value={order.customer_name || '—'}
          />
          {order.customer_email && (
            <InfoLine
              icon={<Mail className="w-3.5 h-3.5" />}
              label="Email"
              value={order.customer_email}
            />
          )}
          {order.customer_phone && (
            <InfoLine
              icon={<Phone className="w-3.5 h-3.5" />}
              label="Phone"
              value={order.customer_phone}
            />
          )}
          {order.address && (
            <InfoLine
              icon={<MapPin className="w-3.5 h-3.5" />}
              label="Address"
              value={order.address}
            />
          )}
          {order.notes && (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 mt-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Special instructions
              </p>
              <p className="text-xs mt-1">{order.notes}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center sm:items-end gap-2">
          <div className="rounded-xl border border-border bg-white p-3">
            <QRCode
              value={qrUrl}
              size={104}
              renderAs="svg"
              level="M"
              includeMargin={false}
              fgColor="#0f172a"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center sm:text-right max-w-[180px] leading-snug">
            Scan to order again from{' '}
            <span className="font-semibold text-foreground">
              {order.business_name}
            </span>
          </p>
        </div>
      </section>

      {/* Footer band */}
      <footer
        className="px-6 sm:px-8 py-4 text-center text-[11px]"
        style={{
          backgroundColor: `${accent}0A`,
          color: '#475569',
        }}
      >
        Powered by{' '}
        <span className="font-semibold" style={{ color: accent }}>
          MyFoodBase
        </span>{' '}
        · myfoodbase.vercel.app
      </footer>
    </article>
  );
};

ReceiptDocument.displayName = 'ReceiptDocument';

// -------------- Small atoms --------------

function MetaCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div className="mt-1 truncate">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 w-6 h-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
