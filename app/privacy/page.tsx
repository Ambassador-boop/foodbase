import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Privacy Policy - FoodBase',
  description: 'FoodBase Privacy Policy',
};

export default function PrivacyPage() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-base text-muted-foreground">Last updated: March 2024</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-sm max-w-none">
          <h2 className="text-2xl font-bold mb-6">Introduction</h2>
          <p className="text-muted-foreground mb-6">
            FoodBase ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our application, or interact with our services (collectively, the "Services").
          </p>
          <p className="text-muted-foreground mb-8">
            Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Services. By accessing and using FoodBase, you acknowledge that you have read, understood, and agree to be bound by all the provisions of this Privacy Policy.
          </p>

          <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
          <p className="text-muted-foreground mb-4">
            We collect information in various ways, including when you voluntarily provide it to us, when third parties provide it, and through automatic collection mechanisms:
          </p>
          <div className="space-y-4 mb-8">
            <div>
              <h3 className="font-semibold mb-2">Personal Information You Provide</h3>
              <p className="text-muted-foreground text-sm mb-3">
                When you register for an account, we collect information such as: name, email address, phone number, business name, address, payment information, and any other information you choose to provide. When you use our Services, we collect details about your restaurant's operations, including menu items, pricing, customer information, order details, and payment transactions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Automatically Collected Information</h3>
              <p className="text-muted-foreground text-sm mb-3">
                When you access our Services, we automatically collect certain information about your device and usage patterns, including: IP address, browser type, operating system, pages visited, time spent on pages, referring URL, and device identifiers. We use cookies, pixel tags, and similar tracking technologies to collect this information for analytics and improving user experience.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Third-Party Information</h3>
              <p className="text-muted-foreground text-sm mb-3">
                We may receive information from third parties such as payment processors (Paystack), analytics providers, and other service partners. This information helps us provide better services and prevent fraud. We only use third-party information in accordance with their terms and this privacy policy.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
          <p className="text-muted-foreground mb-4">
            We use collected information for various legitimate business purposes:
          </p>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• To provide, maintain, and improve our Services</li>
            <li>• To process transactions and send transaction-related information</li>
            <li>• To send promotional communications (with your consent)</li>
            <li>• To respond to your inquiries and provide customer support</li>
            <li>• To analyze usage patterns and improve functionality</li>
            <li>• To comply with legal obligations and enforce agreements</li>
            <li>• To detect, prevent, and address fraud and technical issues</li>
            <li>• To personalize your experience and deliver relevant content</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">3. Data Retention</h2>
          <p className="text-muted-foreground mb-8">
            We retain personal information for as long as necessary to provide our Services and fulfill the purposes outlined in this Privacy Policy. For account information, we retain it for the duration of your account and for a reasonable period afterward to comply with legal obligations. Transaction records are retained for a minimum of 7 years as required by financial regulations. You can request deletion of your data at any time, subject to legal retention requirements.
          </p>

          <h2 className="text-2xl font-bold mb-4">4. Information Sharing and Disclosure</h2>
          <p className="text-muted-foreground mb-4">
            We do not sell your personal information. However, we may share information in these circumstances:
          </p>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• With service providers who assist in operating our platform and services</li>
            <li>• With payment processors (Paystack) for transaction processing</li>
            <li>• When required by law or to protect our legal rights</li>
            <li>• In connection with merger, acquisition, or sale of assets</li>
            <li>• With your explicit consent for specific purposes</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">5. Security</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase implements comprehensive security measures to protect your information. All data in transit is encrypted using TLS 1.3, and sensitive information at rest is encrypted using 256-bit AES encryption. We maintain regular security audits, penetration testing, and vulnerability assessments. However, no method of transmission is 100% secure, and we cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials.
          </p>

          <h2 className="text-2xl font-bold mb-4">6. Your Rights</h2>
          <p className="text-muted-foreground mb-4">
            Depending on your location, you may have the following rights:
          </p>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• Right to access your personal information</li>
            <li>• Right to correct inaccurate information</li>
            <li>• Right to request deletion of your information</li>
            <li>• Right to opt-out of marketing communications</li>
            <li>• Right to data portability (receive your data in transferable format)</li>
            <li>• Right to withdraw consent at any time</li>
            <li>• Right to lodge a complaint with a data protection authority</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">7. International Transfers</h2>
          <p className="text-muted-foreground mb-8">
            Your information may be transferred to, stored in, and processed in countries other than your country of residence. These countries may have data protection laws that differ from your home country. By using FoodBase, you consent to the transfer of your information to countries outside your country of residence, which may have different data protection rules.
          </p>

          <h2 className="text-2xl font-bold mb-4">8. Children's Privacy</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected information from a child under 18, we will take steps to delete such information promptly and terminate the child's account.
          </p>

          <h2 className="text-2xl font-bold mb-4">9. Cookies and Tracking</h2>
          <p className="text-muted-foreground mb-8">
            We use cookies to enhance your experience. Essential cookies are necessary for platform functionality and cannot be disabled. Analytics cookies help us understand how users interact with our Services. Preference cookies remember your settings. Marketing cookies track your activity across sites. You can control cookie settings through your browser, but disabling essential cookies may affect functionality.
          </p>

          <h2 className="text-2xl font-bold mb-4">10. Third-Party Links</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase may contain links to third-party websites. We are not responsible for the privacy practices of other websites. We encourage you to review the privacy policies of any third-party sites before providing your information or using their services.
          </p>

          <h2 className="text-2xl font-bold mb-4">11. Contact Us</h2>
          <p className="text-muted-foreground mb-4">
            If you have questions about this Privacy Policy or our privacy practices, please contact us at:
          </p>
          <div className="bg-primary/5 border border-border rounded-lg p-6">
            <p className="font-semibold mb-2">FoodBase Privacy Team</p>
            <p className="text-sm text-muted-foreground">Email: privacy@foodbase.com</p>
            <p className="text-sm text-muted-foreground">Address: Lagos, Nigeria</p>
            <p className="text-sm text-muted-foreground">Response time: Within 48 hours</p>
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
