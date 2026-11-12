import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Check, Menu, Package, Zap, TrendingUp, Lock, Smartphone, BarChart3 } from 'lucide-react';

export default function HomePage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Image
              src="/foodbase-logo.png"
              alt="FoodBase"
              width={32}
              height={32}
            />
            <span className="text-primary">FoodBase</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/register/restaurant"
              className="inline-flex min-h-[44px] items-center rounded-md px-2 text-xs font-medium text-foreground underline-offset-4 hover:text-primary hover:underline sm:min-h-[36px]"
            >
              <span className="sm:hidden">Register</span>
              <span className="hidden sm:inline">Register your restaurant</span>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="h-8 text-xs">
                Log In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-24 md:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 text-foreground">
                Restaurant Management, Simplified
              </h1>
              <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                FoodBase is the all-in-one platform for modern restaurants. Accept orders, manage your menu, process payments, and grow your business—all from one intuitive dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/login">
                  <Button className="w-full sm:w-auto h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium">
                    Get Started
                  </Button>
                </Link>
                <Button variant="outline" className="w-full sm:w-auto h-9 text-sm font-medium">
                  Schedule Demo
                </Button>
              </div>
              <div className="mt-8 pt-6 border-t border-border space-y-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Secure payment processing with Paystack</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Real-time order management and tracking</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Beautiful, mobile-optimized customer interface</span>
                </div>
              </div>
            </div>
            <div className="relative h-80 md:h-96 rounded-lg overflow-hidden">
              <Image
                src="/hero-restaurants.jpg"
                alt="Restaurant Management"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-12 md:py-20 bg-primary/5 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Core Features</h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              Everything restaurants need to succeed in the digital era
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border border-border rounded bg-white">
              <Menu className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold text-sm mb-2">Menu Management</h3>
              <p className="text-xs text-muted-foreground">Create and organize dishes, manage pricing, track popular items</p>
            </div>
            <div className="p-4 border border-border rounded bg-white">
              <Package className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold text-sm mb-2">Add-ons System</h3>
              <p className="text-xs text-muted-foreground">Define proteins, sides, toppings. Let customers customize meals</p>
            </div>
            <div className="p-4 border border-border rounded bg-white">
              <Zap className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold text-sm mb-2">Real-time Orders</h3>
              <p className="text-xs text-muted-foreground">Receive orders instantly, track status, manage queue</p>
            </div>
            <div className="p-4 border border-border rounded bg-white">
              <TrendingUp className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold text-sm mb-2">Analytics</h3>
              <p className="text-xs text-muted-foreground">Track revenue, monitor trends, optimize operations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Orders Management Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="relative h-80 md:h-96 rounded-lg overflow-hidden order-2 lg:order-1">
              <Image
                src="/orders-management.jpg"
                alt="Orders Management"
                fill
                className="object-cover"
              />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-bold mb-3">Manage Orders Effortlessly</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Receive customer orders in real-time, view detailed breakdowns with customer selections, and manage your kitchen workflow seamlessly from one dashboard.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Instant order notifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Order status tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Customer details included</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Complete order history</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Payments Section */}
      <section className="py-12 md:py-20 bg-primary/5 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-3">Secure Payment Processing</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Accept payments from customers instantly with Paystack. Funds are transferred to your account, with withdrawals available the next business day.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Secure Paystack integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Instant payment confirmation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Automatic fund settlements</span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Transparent transaction history</span>
                </li>
              </ul>
            </div>
            <div className="relative h-80 md:h-96 rounded-lg overflow-hidden">
              <Image
                src="/payments-processing.jpg"
                alt="Payment Processing"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Business Benefits */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Why Choose FoodBase?</h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              Built specifically for modern restaurants and food businesses
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 border border-border rounded-lg">
              <Smartphone className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold text-sm mb-2">Mobile-First Design</h3>
              <p className="text-xs text-muted-foreground">
                Optimized for every device. Your customers can order on the go, and you manage from anywhere.
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg">
              <BarChart3 className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold text-sm mb-2">Business Analytics</h3>
              <p className="text-xs text-muted-foreground">
                Detailed insights on orders, revenue, customer trends, and performance metrics.
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold text-sm mb-2">Growth Tools</h3>
              <p className="text-xs text-muted-foreground">
                QR codes, popular dishes tracking, and customer engagement features to boost sales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-gradient-to-r from-primary to-accent text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Ready to Transform Your Restaurant?</h2>
          <p className="text-base opacity-90 mb-8 max-w-2xl mx-auto">
            Join restaurants across Nigeria that are serving customers better with FoodBase. Start accepting orders and payments today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button className="bg-white text-primary hover:bg-white/90 h-9 font-medium">
                Get Started Now
              </Button>
            </Link>
            <Button variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 h-9 font-medium">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Image
                  src="/foodbase-logo-black.png"
                  alt="FoodBase"
                  width={28}
                  height={28}
                />
                <span className="font-bold">FoodBase</span>
              </div>
              <p className="text-xs text-gray-400">
                Restaurant management platform for the modern age.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link href="/" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/security" className="hover:text-white">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Company</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="#" className="hover:text-white">Blog</Link></li>
                <li><Link href="#" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                <li><Link href="/refund-policy" className="hover:text-white">Refund Policy</Link></li>
                <li><Link href="/cancellation-policy" className="hover:text-white">Cancellation Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-xs text-gray-400">
            <p>© {currentYear} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
