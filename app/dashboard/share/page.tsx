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
      const response = await fetch('/api/business', {
        credentials: 'include',
      });
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="h-80 bg-muted rounded-xl"></div>
            <div className="h-20 bg-muted rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Share Your Business</h1>
          <p className="text-xs text-muted-foreground">Generate QR code and share your restaurant</p>
        </div>

        {business && (
          <>
            {/* QR Code Section */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-6 md:p-8 hover:shadow-md transition-shadow duration-300">
              <div className="flex flex-col items-center space-y-4">
                {/* Preview for PDF */}
                <div ref={pdfRef} className="w-full bg-white p-8 flex flex-col items-center space-y-4 rounded-lg">
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
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <button
                    onClick={handleDownloadQR}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors duration-200 gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity duration-200 gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Share Link */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow duration-300 space-y-3">
              <h2 className="text-sm font-semibold text-card-foreground">Share Link</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={restaurantUrl}
                  readOnly
                  className="flex-1 h-8 text-xs border border-input rounded-lg px-3 py-2 bg-muted/30 text-foreground"
                />
                <button
                  onClick={handleCopyUrl}
                  className="inline-flex items-center justify-center px-3 py-1.5 bg-muted text-foreground rounded-lg font-medium text-xs hover:bg-muted/80 transition-colors duration-200 gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 md:p-6 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">How to Share</h2>
              <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                <li>Download the QR code and print it or display on your storefront</li>
                <li>Share the link on social media, WhatsApp, or email</li>
                <li>Customers can scan the QR code or click the link to view your menu</li>
                <li>They can place orders directly through their browser</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
