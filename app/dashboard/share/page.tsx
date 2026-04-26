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
  logo_url?: string;
}

export default function ShareBusinessPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingPNG, setDownloadingPNG] = useState(false);

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

  const prepareElementForCapture = (element: HTMLElement): HTMLElement => {
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Force safe colors and remove problematic CSS variables
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#000000';
    
    // Walk through all child elements and apply safe styles
    const walkElements = (el: Element) => {
      const htmlEl = el as HTMLElement;
      
      // Remove all classes to avoid oklch color issues
      htmlEl.removeAttribute('class');
      
      // Apply safe inline styles for common elements
      if (el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'H1' || el.tagName === 'H2') {
        htmlEl.style.backgroundColor = 'transparent';
        htmlEl.style.color = '#000000';
        htmlEl.style.borderColor = '#cccccc';
      }
      
      // Handle border elements
      if (htmlEl.style.borderWidth && htmlEl.style.borderWidth !== '0px') {
        htmlEl.style.borderColor = '#cccccc';
      }
      
      // Recursively process children
      Array.from(el.children).forEach(child => walkElements(child));
    };
    
    walkElements(clone);
    return clone;
  };

  const handleDownloadQR = async () => {
    try {
      setDownloadingPNG(true);
      setError('');
      console.log('[v0] Starting PNG download process');
      
      if (!pdfRef.current) {
        throw new Error('Content not ready. Please try again.');
      }

      // Wait for QR code canvas to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 800));

      // Prepare element with safe styles
      const preparedElement = prepareElementForCapture(pdfRef.current);
      preparedElement.style.position = 'absolute';
      preparedElement.style.left = '-9999px';
      preparedElement.style.top = '-9999px';
      
      document.body.appendChild(preparedElement);

      // Generate PNG from the prepared content
      const canvas = await html2canvas(preparedElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        allowTaint: true,
        logging: false,
        foreignObjectRendering: true,
      });

      document.body.removeChild(preparedElement);

      console.log('[v0] PNG canvas created:', { width: canvas.width, height: canvas.height });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${business?.slug}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('[v0] PNG downloaded successfully');
    } catch (error) {
      console.error('[v0] Error downloading PNG:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Could not generate PNG: ${errorMsg}. Try refreshing the page.`);
    } finally {
      setDownloadingPNG(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!pdfRef.current) {
      setError('Content not ready. Please refresh the page.');
      return;
    }

    try {
      setDownloadingPDF(true);
      setError('');
      console.log('[v0] Starting PDF download process');

      // Wait for QR code to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 800));

      // Prepare element with safe styles
      const preparedElement = prepareElementForCapture(pdfRef.current);
      preparedElement.style.position = 'absolute';
      preparedElement.style.left = '-9999px';
      preparedElement.style.top = '-9999px';
      
      document.body.appendChild(preparedElement);

      const canvas = await html2canvas(preparedElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        allowTaint: true,
        logging: false,
        foreignObjectRendering: true,
      });

      document.body.removeChild(preparedElement);

      console.log('[v0] PDF canvas created:', { width: canvas.width, height: canvas.height });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      console.log('[v0] PDF dimensions - Width:', imgWidth, 'Height:', imgHeight);

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      const filename = `${business?.slug}-qr-code.pdf`;
      console.log('[v0] Saving PDF as:', filename);
      
      pdf.save(filename);
      console.log('[v0] PDF saved successfully');
    } catch (error) {
      console.error('[v0] Error generating PDF:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Could not generate PDF: ${errorMsg}. Try refreshing the page.`);
    } finally {
      setDownloadingPDF(false);
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
                <div ref={pdfRef} className="w-full bg-white p-12 flex flex-col items-center space-y-6 rounded-lg">
                  {/* Header Section */}
                  <div className="text-center w-full border-b border-gray-200 pb-6">
                    {/* Restaurant Logo */}
                    {business.logo_url ? (
                      <img
                        src={business.logo_url}
                        alt={business.name}
                        className="h-16 w-auto mx-auto mb-4 object-contain"
                      />
                    ) : (
                      <div className="h-16 w-16 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-400">Logo</span>
                      </div>
                    )}
                    {/* Restaurant Name */}
                    <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
                    <p className="text-sm text-gray-600 mt-2">Order Online</p>
                  </div>

                  {/* QR Code Section */}
                  <div className="flex flex-col items-center space-y-3">
                    <div id="qr-code" className="bg-white p-4 border-4 border-gray-900 rounded-lg">
                      <QRCode
                        value={restaurantUrl}
                        size={240}
                        level="H"
                        includeMargin={true}
                        renderAs="canvas"
                      />
                    </div>
                    <p className="text-sm font-semibold text-gray-900">Scan to Order</p>
                  </div>

                  {/* Instructions Section */}
                  <div className="w-full text-center border-t border-gray-200 pt-6">
                    <h2 className="text-sm font-bold text-gray-900 mb-3">How to Order</h2>
                    <ol className="text-xs text-gray-700 space-y-2 text-left inline-block">
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-gray-900 flex-shrink-0">1.</span>
                        <span>Scan the QR code with your smartphone</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-gray-900 flex-shrink-0">2.</span>
                        <span>Browse our menu and select items</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-gray-900 flex-shrink-0">3.</span>
                        <span>Add your delivery address and notes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-gray-900 flex-shrink-0">4.</span>
                        <span>Complete payment and track your order</span>
                      </li>
                    </ol>
                  </div>

                  {/* Footer Section */}
                  <div className="w-full text-center border-t border-gray-200 pt-4">
                    <p className="text-xs text-gray-500">Powered by FoodBase</p>
                    <p className="text-xs text-gray-400 mt-1">{restaurantUrl}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <button
                    onClick={handleDownloadQR}
                    disabled={downloadingPNG}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {downloadingPNG ? 'Downloading...' : 'Download PNG'}
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={downloadingPDF}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {downloadingPDF ? 'Generating PDF...' : 'Download PDF (A4)'}
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

            {/* Error Message Display */}
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-start gap-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 md:p-6 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">How to Share</h2>
              <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                <li>Download the PDF or PNG and print it or display on your storefront</li>
                <li>Share the link on social media, WhatsApp, or email</li>
                <li>Customers can scan the QR code or click the link to view your menu</li>
                <li>They can place orders directly through their browser</li>
                <li>The PDF is formatted as A4 size for easy printing</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
