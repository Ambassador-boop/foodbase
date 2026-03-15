import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Refund Policy - FoodBase',
  description: 'FoodBase Refund Policy',
};

export default function RefundPolicyPage() {
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

      {/* Header */}
      <section className="py-12 md:py-20 bg-primary/5 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Refund Policy</h1>
          <p className="text-base text-muted-foreground">Last updated: March 2024</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-sm max-w-none">
          <h2 className="text-2xl font-bold mb-6">Overview</h2>
          <p className="text-muted-foreground mb-8">
            At FoodBase, we want you to be completely satisfied with our service. This Refund Policy outlines the circumstances under which refunds will be issued for subscription fees paid to FoodBase. Please read this policy carefully to understand our refund practices.
          </p>

          <h2 className="text-2xl font-bold mb-4">1. Subscription Refunds</h2>
          <h3 className="text-lg font-semibold mb-3">14-Day Money-Back Guarantee</h3>
          <p className="text-muted-foreground mb-6">
            If you're not completely satisfied with FoodBase within the first 14 days of your subscription, we offer a full refund of your subscription fee. This applies to all plans: Starter, Professional, and Enterprise. To request a refund within this period, simply contact our support team at support@foodbase.com with your account details and reason for the refund request. We will process your refund within 5-7 business days after approval.
          </p>

          <h3 className="text-lg font-semibold mb-3">Partial Month Refunds</h3>
          <p className="text-muted-foreground mb-8">
            If you cancel your subscription mid-month, you will receive a pro-rated refund for the unused portion of your subscription, calculated on a daily basis. For example, if you paid ₦15,000 for a 30-day month and cancel after 10 days of use, you will receive a refund of ₦10,000 (calculated as ₦500/day × 20 remaining days). Pro-rated refunds are automatically processed within 7-10 business days of cancellation.
          </p>

          <h2 className="text-2xl font-bold mb-4">2. Payment Processing Refunds</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase does not directly hold customer order payments. All customer payments are processed through Paystack and transferred directly to your restaurant's account. Transaction fees (1.5% + ₦100 per transaction) charged by Paystack are non-refundable as they represent the cost of payment processing services. For refunds related to customer orders, please refer to our dispute resolution process or contact Paystack directly.
          </p>

          <h2 className="text-2xl font-bold mb-4">3. Non-Refundable Items</h2>
          <p className="text-muted-foreground mb-6">
            The following items and services are non-refundable:
          </p>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• Paystack transaction fees</li>
            <li>• Premium support add-ons once services have been rendered</li>
            <li>• Training and onboarding sessions completed</li>
            <li>• Custom development or integrations requested and completed</li>
            <li>• Annual subscriptions (outside the 14-day period)</li>
            <li>• Monthly subscriptions after 14 days from initial purchase</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">4. How to Request a Refund</h2>
          <p className="text-muted-foreground mb-6">
            To request a refund, follow these steps:
          </p>
          <div className="space-y-4 mb-8">
            <div className="bg-primary/5 border border-border rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">Step 1: Contact Support</p>
              <p className="text-sm text-muted-foreground">
                Email support@foodbase.com with your account email address and the reason for your refund request. Include any relevant details that help us understand your request better.
              </p>
            </div>
            <div className="bg-primary/5 border border-border rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">Step 2: Verification</p>
              <p className="text-sm text-muted-foreground">
                Our support team will verify your request and confirm your eligibility for a refund based on this policy. We may ask clarifying questions about your subscription or experience with FoodBase.
              </p>
            </div>
            <div className="bg-primary/5 border border-border rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">Step 3: Approval and Processing</p>
              <p className="text-sm text-muted-foreground">
                Once approved, we will initiate the refund to your original payment method. Refunds are processed within 5-10 business days, though your bank may take an additional 2-5 business days to credit the amount to your account.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4">5. Refund Processing Timeline</h2>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• Request submitted: Same day acknowledgment</li>
            <li>• Verification: 1-2 business days</li>
            <li>• Refund processing: 5-7 business days from approval</li>
            <li>• Bank processing: 2-5 additional business days</li>
            <li>• Total timeframe: 10-15 business days</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">6. Refunds for Canceled Accounts</h2>
          <p className="text-muted-foreground mb-8">
            If your FoodBase account is canceled due to violation of our Terms of Service, you are not eligible for a refund of subscription fees. However, refunds of customer payments processed through FoodBase (minus applicable transaction fees) may be provided on a case-by-case basis after investigation. Contact our support team for further discussion.
          </p>

          <h2 className="text-2xl font-bold mb-4">7. Dispute Resolution</h2>
          <p className="text-muted-foreground mb-8">
            If you believe you are entitled to a refund that has been denied, or if you have additional questions about our refund policy, please contact our support team at support@foodbase.com or legal@foodbase.com. We will review your case and provide a response within 10 business days. We're committed to resolving disputes fairly and maintaining positive relationships with our customers.
          </p>

          <h2 className="text-2xl font-bold mb-4">8. Policy Changes</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase reserves the right to modify this Refund Policy at any time. Changes will be communicated via email to all active subscribers at least 30 days before taking effect. Continued use of FoodBase after notification of changes constitutes acceptance of the updated policy. Your rights under this policy are not diminished for subscriptions purchased before any policy changes.
          </p>

          <h2 className="text-2xl font-bold mb-4">9. Contact Us</h2>
          <p className="text-muted-foreground mb-4">
            If you have any questions about this Refund Policy or need to request a refund, please contact us:
          </p>
          <div className="bg-primary/5 border border-border rounded-lg p-6 mb-8">
            <p className="font-semibold mb-2">FoodBase Support Team</p>
            <p className="text-sm text-muted-foreground">Email: support@foodbase.com</p>
            <p className="text-sm text-muted-foreground">Response time: Within 24 hours</p>
            <p className="text-sm text-muted-foreground">Address: Lagos, Nigeria</p>
          </div>

          <div className="bg-accent/10 border border-accent rounded-lg p-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Note:</span> This Refund Policy is designed to be fair to both FoodBase and our customers. We believe in the quality of our service and are confident you'll find value in using FoodBase for your restaurant. If for any reason you're not satisfied within the first 14 days, we're happy to provide a full refund, no questions asked.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-white py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Image
                  src="/foodbase-logo.png"
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
