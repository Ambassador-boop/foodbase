import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Cancellation Policy - FoodBase',
  description: 'FoodBase Cancellation Policy',
};

export default function CancellationPolicyPage() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Cancellation Policy</h1>
          <p className="text-base text-muted-foreground">Last updated: March 2024</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-sm max-w-none">
          <h2 className="text-2xl font-bold mb-6">Overview</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase is committed to providing you with full flexibility in managing your subscription. This Cancellation Policy explains how you can cancel your subscription at any time, without penalties or long-term commitments. We believe that if you choose to stay with FoodBase, it should be because you value our service, not because you're locked in by a contract.
          </p>

          <h2 className="text-2xl font-bold mb-4">1. No Long-Term Contracts</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase does not require you to commit to any long-term contracts. Whether you choose a monthly or annual billing cycle, you maintain the flexibility to cancel your subscription at any time. There are no cancellation fees, no penalties, and no minimum subscription periods. Your subscription can be canceled with immediate effect.
          </p>

          <h2 className="text-2xl font-bold mb-4">2. How to Cancel Your Subscription</h2>
          <p className="text-muted-foreground mb-6">
            Canceling your FoodBase subscription is simple and can be done in multiple ways:
          </p>

          <h3 className="text-lg font-semibold mb-3">Option 1: Self-Service Cancellation (Recommended)</h3>
          <p className="text-muted-foreground mb-6">
            The quickest way to cancel is through your FoodBase account dashboard. Log in to your account, navigate to Settings → Billing → Subscription, and click the "Cancel Subscription" button. You'll be prompted to confirm the cancellation and optionally provide feedback about your experience. Your cancellation will be processed immediately.
          </p>

          <h3 className="text-lg font-semibold mb-3">Option 2: Contact Support</h3>
          <p className="text-muted-foreground mb-8">
            If you prefer, you can request cancellation by emailing support@foodbase.com with your account email address and request for cancellation. Our support team will process your request within 24 hours and confirm cancellation via email. If you have any questions or concerns before canceling, our support team is happy to discuss them with you.
          </p>

          <h2 className="text-2xl font-bold mb-4">3. What Happens When You Cancel</h2>
          <div className="space-y-4 mb-8">
            <div className="bg-primary/5 border border-border rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">Immediate Effects</p>
              <p className="text-sm text-muted-foreground">
                Upon cancellation, your subscription status changes to "canceled" immediately. No further charges will be made to your account. However, you will continue to have access to your restaurant's data and the FoodBase dashboard until the end of your current billing period.
              </p>
            </div>
            <div className="bg-primary/5 border border-border rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">End of Billing Period</p>
              <p className="text-sm text-muted-foreground">
                Your access to FoodBase features ends at the conclusion of your current billing cycle (end of month for monthly subscriptions, end of year for annual subscriptions). This gives you time to download your data, export reports, and plan your transition.
              </p>
            </div>
            <div className="bg-primary/5 border border-border rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">Data Retention</p>
              <p className="text-sm text-muted-foreground">
                Your restaurant's data, order history, and customer information will be retained for 90 days after your cancellation. During this period, you can request to reactivate your account. After 90 days, data may be permanently deleted in accordance with our data retention policies.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4">4. Pro-Rated Refunds for Mid-Month Cancellations</h2>
          <p className="text-muted-foreground mb-8">
            If you cancel your monthly subscription before the end of your billing cycle, you will receive a pro-rated refund for the unused portion of your subscription. The refund is calculated on a daily basis. For example, if your monthly fee is ₦15,000 (30 days) and you cancel on day 10, you will receive a refund of ₦10,000 (20 remaining days × ₦500/day). Pro-rated refunds are automatically processed within 7-10 business days of cancellation to your original payment method.
          </p>

          <h2 className="text-2xl font-bold mb-4">5. Annual Subscription Cancellations</h2>
          <p className="text-muted-foreground mb-8">
            For annual subscriptions, cancellation requests are honored immediately. If you cancel within the first 30 days of your annual subscription, you will receive a full refund. If you cancel after 30 days, you may cancel anytime, but refunds are not available for annual subscriptions (outside the initial 30-day period). However, you will continue to have access until the end of your contracted year, and no additional charges will be made.
          </p>

          <h2 className="text-2xl font-bold mb-4">6. Enterprise Plan Cancellations</h2>
          <p className="text-muted-foreground mb-8">
            Enterprise plans may have custom terms negotiated directly with our sales team. For Enterprise plan cancellations, please contact your dedicated account manager or email sales@foodbase.com to discuss termination options, data transition plans, and any applicable wind-down procedures. Most Enterprise agreements include transition support to ensure minimal disruption to your operations.
          </p>

          <h2 className="text-2xl font-bold mb-4">7. Account Reactivation</h2>
          <p className="text-muted-foreground mb-8">
            Changed your mind? If you cancel your subscription but decide to return within 90 days, you can easily reactivate your account by logging in and selecting a plan. Your previous data will be restored, and you can continue where you left off. Simply follow the standard signup and payment process, and your account will be fully restored within a few minutes.
          </p>

          <h2 className="text-2xl font-bold mb-4">8. Data Export Before Cancellation</h2>
          <p className="text-muted-foreground mb-8">
            Before canceling your subscription, we encourage you to export your important data. FoodBase provides tools to export your menu, customer information, order history, and analytics reports. You can access data export options in your account settings. If you need assistance with data export, contact our support team at support@foodbase.com, and we'll provide the data in your preferred format.
          </p>

          <h2 className="text-2xl font-bold mb-4">9. Cancellation Confirmations</h2>
          <p className="text-muted-foreground mb-8">
            Once your subscription is canceled, you will receive a confirmation email with details including your cancellation date, any applicable refunds, and your data retention timeline. This email serves as official documentation of your cancellation. Please retain this email for your records. If you don't receive a confirmation email within 24 hours, please contact support@foodbase.com.
          </p>

          <h2 className="text-2xl font-bold mb-4">10. Feedback and Improvement</h2>
          <p className="text-muted-foreground mb-8">
            We'd love to hear why you're canceling. When you initiate cancellation through your dashboard, we'll ask you to provide optional feedback about your experience. Your input helps us identify areas for improvement and develop features that better serve restaurant owners. If you're canceling due to a specific issue, our support team may reach out to see if we can resolve the problem.
          </p>

          <h2 className="text-2xl font-bold mb-4">11. Involuntary Cancellations</h2>
          <p className="text-muted-foreground mb-6">
            FoodBase may cancel accounts in the following circumstances:
          </p>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• Violation of our Terms of Service or Acceptable Use Policy</li>
            <li>• Fraudulent activity or misuse of the platform</li>
            <li>• Non-payment of subscription fees (after 30 days of notice)</li>
            <li>• Illegal activities or content</li>
            <li>• Repeated harassment of FoodBase staff</li>
          </ul>
          <p className="text-muted-foreground mb-8">
            In cases of involuntary cancellation, we will provide written notice explaining the reason and any applicable appeal process. For non-payment, a 30-day notice period is provided to settle outstanding fees before account suspension.
          </p>

          <h2 className="text-2xl font-bold mb-4">12. Transition Support</h2>
          <p className="text-muted-foreground mb-8">
            We understand that switching platforms can be challenging. If you're canceling to move to another system, our support team can provide guidance on data export, API documentation, and integration options. We want your transition to be as smooth as possible. Contact support@foodbase.com for transition assistance.
          </p>

          <h2 className="text-2xl font-bold mb-4">13. Contact Information</h2>
          <p className="text-muted-foreground mb-4">
            For any questions about cancellation or if you need assistance with the process:
          </p>
          <div className="bg-primary/5 border border-border rounded-lg p-6 mb-8">
            <p className="font-semibold mb-2">FoodBase Support Team</p>
            <p className="text-sm text-muted-foreground">Email: support@foodbase.com</p>
            <p className="text-sm text-muted-foreground">Response time: Within 24 hours</p>
            <p className="text-sm text-muted-foreground">Available: Monday - Friday, 9 AM - 6 PM WAT</p>
          </div>

          <div className="bg-accent/10 border border-accent rounded-lg p-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Final Note:</span> We believe in transparency and flexibility. This Cancellation Policy is designed to protect your interests and give you complete control over your subscription. We don't believe in tricky cancellation processes or hidden fees. If you decide FoodBase isn't right for you, canceling should be straightforward and hassle-free. We respect your decision and hope that if you leave, it's because you've found a solution that better meets your needs.
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
