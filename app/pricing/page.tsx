import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export const metadata = {
  title: 'Pricing - FoodBase',
  description: 'Flexible pricing plans for restaurants of all sizes',
};

export default function PricingPage() {
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
            <Link href="/login">
              <Button variant="outline" className="h-8 text-xs">
                Log In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Pricing Header */}
      <section className="py-12 md:py-20 bg-primary/5 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your restaurant. No hidden fees, no long-term contracts. Scale as your business grows.
          </p>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Starter Plan */}
            <div className="border border-border rounded-lg p-8 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <p className="text-muted-foreground text-sm mb-6">Perfect for new restaurants</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">₦5,000</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Up to 50 orders/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Basic menu management</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Single restaurant location</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Email support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Payment processing included</span>
                </li>
              </ul>
              <Link href="/login">
                <Button className="w-full bg-primary text-white hover:bg-primary-dark">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Professional Plan */}
            <div className="border-2 border-primary rounded-lg p-8 shadow-lg relative md:scale-105">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-3 py-1 rounded text-xs font-semibold">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Professional</h3>
              <p className="text-muted-foreground text-sm mb-6">For growing restaurants</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">₦15,000</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Up to 500 orders/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Advanced menu customization</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Up to 3 restaurant locations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Priority email & phone support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Analytics dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Add-ons management</span>
                </li>
              </ul>
              <Link href="/login">
                <Button className="w-full bg-primary text-white hover:bg-primary-dark">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="border border-border rounded-lg p-8 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <p className="text-muted-foreground text-sm mb-6">For large restaurant chains</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Unlimited orders</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Unlimited locations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>24/7 phone support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Custom integrations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Advanced security features</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full">
                Contact Sales
              </Button>
            </div>
          </div>

          {/* Pricing Details */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">What's Included</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-primary/5 border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-3">Payment Processing</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  All plans include Paystack integration with competitive transaction fees. Paystack charges 1.5% + ₦100 per transaction. There are no additional FoodBase processing fees.
                </p>
              </div>
              <div className="bg-primary/5 border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-3">Setup & Training</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Professional and Enterprise plans include free setup assistance and basic training for your team to help you get started quickly and maximize the platform's benefits.
                </p>
              </div>
              <div className="bg-primary/5 border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-3">No Long-Term Contracts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cancel anytime with no penalties. We're confident you'll love FoodBase, and we want you to stay because you choose to, not because you're locked in.
                </p>
              </div>
              <div className="bg-primary/5 border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-3">Mobile App Access</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  All plans include access to our mobile app for restaurant managers to receive and manage orders on the go, keeping you connected to your business always.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-20 bg-primary/5 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="border border-border rounded-lg p-4 cursor-pointer">
              <summary className="font-semibold text-sm">Can I change plans anytime?</summary>
              <p className="text-sm text-muted-foreground mt-3">
                Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle with prorated adjustments made to your account.
              </p>
            </details>
            <details className="border border-border rounded-lg p-4 cursor-pointer">
              <summary className="font-semibold text-sm">What payment methods do you accept?</summary>
              <p className="text-sm text-muted-foreground mt-3">
                We accept all major payment methods through Paystack, including bank transfers, cards, and mobile money options available in Nigeria.
              </p>
            </details>
            <details className="border border-border rounded-lg p-4 cursor-pointer">
              <summary className="font-semibold text-sm">Do you offer discounts for annual billing?</summary>
              <p className="text-sm text-muted-foreground mt-3">
                Yes, we offer a 15% discount when you choose annual billing. Contact our sales team at sales@foodbase.com for more information on annual plans.
              </p>
            </details>
            <details className="border border-border rounded-lg p-4 cursor-pointer">
              <summary className="font-semibold text-sm">Is there a free trial period?</summary>
              <p className="text-sm text-muted-foreground mt-3">
                We offer a 14-day free trial for all plans. No credit card required to start. You'll have full access to all features during your trial period.
              </p>
            </details>
            <details className="border border-border rounded-lg p-4 cursor-pointer">
              <summary className="font-semibold text-sm">What happens if I exceed my order limit?</summary>
              <p className="text-sm text-muted-foreground mt-3">
                You'll be notified when approaching your limit and can upgrade to a higher tier at any time. We won't charge unexpected overages—you have full control over your plan.
              </p>
            </details>
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
            <p>© 2024 FoodBase. All rights reserved, in conjunction with Wisdom Technologies.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
