'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Copy, Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const QRCode = dynamic(() => import('qrcode.react'), { ssr: false });

interface Business {
  slug: string;
  name: string;
}

export default function ShareBusinessPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      const response = await fetch('/api/business');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setBusiness(data.business);
    } catch (err) {
      setError('Failed to load business details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const baseUrl = 'https://myfoodbase.vercel.app';
  const restaurantUrl = business ? `${baseUrl}/${business.slug}` : '';
  const pdfRef = useRef<HTMLDivElement>(null);

  const handleCopyUrl = () => {
    if (restaurantUrl) {
      navigator.clipboard.writeText(restaurantUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    const element = document.getElementById('qr-code');
    if (element) {
      const canvas = element.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${business?.slug}-qr-code.png`;
        link.click();
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!pdfRef.current) return;

    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${business?.slug}-qr-code.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading business details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold mb-1">Share Your Business</h1>
        <p className="text-xs text-muted-foreground">Generate QR code and share your restaurant</p>
      </div>

      {business && (
        <>
          {/* QR Code Section */}
          <div className="bg-white border border-border rounded-lg p-8">
            <div className="flex flex-col items-center space-y-4">
              {/* Preview for PDF */}
              <div ref={pdfRef} className="w-full bg-white p-8 flex flex-col items-center space-y-4">
                {/* FoodBase Logo and Branding */}
                <div className="text-center mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Powered by</p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-sm font-bold text-primary">FoodBase</span>
                  </div>
                </div>

                {/* QR Code */}
                <div id="qr-code" className="bg-white p-4 border-4 border-primary rounded-lg">
                  <QRCode
                    value={restaurantUrl}
                    size={240}
                    level="H"
                    includeMargin={true}
                    renderAs="canvas"
                  />
                </div>

                {/* Restaurant Info */}
                <div className="text-center space-y-2">
                  <p className="text-lg font-bold text-foreground">{business.name}</p>
                  <p className="text-sm text-primary font-semibold">Scan to order from this restaurant</p>
                  <p className="text-xs text-muted-foreground mt-2">{restaurantUrl}</p>
                </div>
              </div>

              <div className="flex gap-2 w-full">
                <Button
                  onClick={handleDownloadQR}
                  variant="outline"
                  className="flex-1 h-8 text-xs gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download PNG
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  className="flex-1 h-8 text-xs gap-1 bg-primary text-white hover:bg-primary/90"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Share Link */}
          <div className="bg-white border border-border rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold">Share Link</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={restaurantUrl}
                readOnly
                className="flex-1 h-8 text-xs border border-input rounded px-3 py-1 bg-muted/30"
              />
              <Button
                onClick={handleCopyUrl}
                variant="outline"
                className="h-8 text-xs gap-1"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">How to Share</h2>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Download the QR code and print it or display on your storefront</li>
              <li>Share the link on social media, WhatsApp, or email</li>
              <li>Customers can scan the QR code or click the link to view your menu</li>
              <li>They can place orders directly through their browser</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
