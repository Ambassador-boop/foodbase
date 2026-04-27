'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Globe,
  Loader2,
  MessageCircle,
  QrCode,
  Share2,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const QRCode = dynamic(() => import('qrcode.react'), { ssr: false });

interface Business {
  slug: string;
  name: string;
  logo_url?: string;
}

const PUBLIC_BASE_URL = 'https://foodbase.ng';

export default function ShareBusinessPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<null | 'png' | 'pdf'>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const restaurantUrl = useMemo(
    () => (business ? `${PUBLIC_BASE_URL}/${business.slug}` : ''),
    [business]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/business', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load business');
        if (active) setBusiness(data.business);
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load business details');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleCopy = async () => {
    if (!restaurantUrl) return;
    try {
      await navigator.clipboard.writeText(restaurantUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleNativeShare = async () => {
    if (!restaurantUrl || !business) return;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: business.name,
          text: `Order from ${business.name} on FoodBase`,
          url: restaurantUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopy();
    }
  };

  const captureCanvas = async () => {
    const node = cardRef.current;
    if (!node) throw new Error('Share card not ready yet.');

    await new Promise((r) => requestAnimationFrame(() => r(null)));
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      try {
        await (document as any).fonts.ready;
      } catch {
        /* ignore */
      }
    }

    // html2canvas-pro handles modern CSS color functions (oklch, lab, lch).
    const html2canvas = (await import('html2canvas-pro')).default;
    return html2canvas(node, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleDownloadPNG = async () => {
    if (downloading || !business) return;
    setShareOpen(false);
    setDownloading('png');
    const t = toast.loading('Preparing PNG…');
    try {
      await new Promise((r) => setTimeout(r, 60));
      const canvas = await captureCanvas();
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) throw new Error('Could not encode PNG.');
      triggerBlobDownload(blob, `${business.slug}-qr-code.png`);
      toast.success('QR code downloaded', { id: t });
    } catch (err: any) {
      console.error('[v0] PNG download failed', err);
      toast.error(err?.message || 'Could not download PNG.', { id: t });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadPDF = async () => {
    if (downloading || !business) return;
    setShareOpen(false);
    setDownloading('pdf');
    const t = toast.loading('Preparing PDF…');
    try {
      await new Promise((r) => setTimeout(r, 60));
      const canvas = await captureCanvas();
      const { jsPDF } = await import('jspdf');
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const top = imgHeight < pageHeight - margin * 2
        ? (pageHeight - imgHeight) / 2
        : margin;
      pdf.addImage(imgData, 'PNG', margin, top, imgWidth, imgHeight);
      pdf.save(`${business.slug}-qr-code.pdf`);
      toast.success('PDF downloaded', { id: t });
    } catch (err: any) {
      console.error('[v0] PDF download failed', err);
      toast.error(err?.message || 'Could not download PDF.', { id: t });
    } finally {
      setDownloading(null);
    }
  };

  const whatsappLink = useMemo(() => {
    if (!business) return '#';
    const text = encodeURIComponent(
      `Order from ${business.name} on FoodBase: ${restaurantUrl}`
    );
    return `https://wa.me/?text=${text}`;
  }, [business, restaurantUrl]);

  // -------- UI --------

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[520px] bg-muted rounded-2xl animate-pulse" />
          <div className="space-y-3">
            <div className="h-32 bg-muted rounded-xl animate-pulse" />
            <div className="h-32 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Share your business</h1>
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error || 'Business not found.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold mb-2">
            <Sparkles className="w-3 h-3" />
            Share &amp; grow
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Share your business
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            One QR code, one link — print it, post it, share it. Customers
            order from {business.name} in seconds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleNativeShare}
            className="gap-2"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <Button
                disabled={!!downloading}
                className="gap-2"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {downloading
                  ? `Saving ${downloading.toUpperCase()}…`
                  : 'Download'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5">
              <button
                type="button"
                onClick={handleDownloadPNG}
                disabled={!!downloading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                <FileImage className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-left">PNG image</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={!!downloading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-left">PDF (A4)</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: printable QR card */}
        <section>
          <div className="rounded-2xl border border-border bg-gradient-to-br from-muted/40 to-background p-3 sm:p-6">
            <div
              ref={cardRef}
              className="mx-auto w-full max-w-[520px] bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden"
              style={{ color: '#0f172a' }}
            >
              {/* Top brand strip */}
              <div
                className="h-2"
                style={{
                  background:
                    'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
                }}
              />

              <div className="px-8 py-7 text-center">
                {/* Logo */}
                <div
                  className="mx-auto w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {business.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={business.logo_url}
                      alt={`${business.name} logo`}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold" style={{ color: '#0f172a' }}>
                      {business.name?.charAt(0) || '?'}
                    </span>
                  )}
                </div>

                <p
                  className="text-[10px] tracking-[0.25em] font-semibold uppercase mt-4"
                  style={{ color: '#64748b' }}
                >
                  Scan to order
                </p>
                <h2
                  className="text-2xl sm:text-3xl font-bold mt-1 leading-tight"
                  style={{ color: '#0f172a' }}
                >
                  {business.name}
                </h2>
                <p className="text-sm mt-2" style={{ color: '#64748b' }}>
                  Browse the menu &amp; check out in seconds
                </p>
              </div>

              {/* QR */}
              <div className="px-8 pb-6 flex flex-col items-center">
                <div
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #0f172a',
                  }}
                >
                  <QRCode
                    value={restaurantUrl}
                    size={232}
                    renderAs="canvas"
                    level="H"
                    includeMargin={false}
                    fgColor="#0f172a"
                    bgColor="#ffffff"
                  />
                </div>
                <p
                  className="text-[11px] mt-3 font-medium tabular-nums"
                  style={{ color: '#475569' }}
                >
                  {restaurantUrl}
                </p>
              </div>

              {/* Steps */}
              <div
                className="mx-6 sm:mx-8 mb-6 rounded-xl px-5 py-4"
                style={{ backgroundColor: '#f8fafc' }}
              >
                <p
                  className="text-[10px] uppercase tracking-wider font-semibold mb-3"
                  style={{ color: '#64748b' }}
                >
                  How to order
                </p>
                <ol className="space-y-2">
                  {[
                    'Scan the QR code or open the link',
                    'Browse the menu and pick your dishes',
                    'Pay securely and track your order',
                  ].map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm"
                      style={{ color: '#0f172a' }}
                    >
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center"
                        style={{
                          backgroundColor: '#0f172a',
                          color: '#ffffff',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Footer */}
              <footer
                className="px-8 py-3 text-center"
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                }}
              >
                <p className="text-[11px] tracking-wider">
                  Powered by{' '}
                  <span className="font-bold">FoodBase</span>
                </p>
              </footer>
            </div>
          </div>
        </section>

        {/* Right: side panel */}
        <aside className="space-y-4">
          {/* Link */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Your public link</h3>
                <p className="text-xs text-muted-foreground">
                  Share anywhere — works in any browser
                </p>
              </div>
            </div>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={restaurantUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 h-10 text-xs sm:text-sm border border-input rounded-lg px-3 bg-muted/30 font-mono"
              />
              <Button
                onClick={handleCopy}
                variant={copied ? 'default' : 'outline'}
                className="h-10 gap-1.5 px-3"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </Button>
            </div>
            <Link
              href={restaurantUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </Link>
          </div>

          {/* Quick share */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold">Quick share</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                WhatsApp
              </a>
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4 text-blue-600" />
                More…
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Pro tips</h3>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <li>• Print the PDF on A4 and pin it to your storefront</li>
              <li>• Add the QR code to your menu, receipts, and table tents</li>
              <li>• Drop the link in your Instagram bio and WhatsApp status</li>
              <li>• PNG works great for social posts and stories</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
