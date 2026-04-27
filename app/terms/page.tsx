import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Terms of Service - FoodBase',
  description: 'FoodBase Terms of Service',
};

export default function TermsPage() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-base text-muted-foreground">Last updated: March 2024</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-sm max-w-none">
          <h2 className="text-2xl font-bold mb-6">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground mb-8">
            By accessing and using FoodBase, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service. We reserve the right to make changes to these terms at any time without notice. Your continued use of the service following any such changes constitutes your acceptance of the new terms.
          </p>

          <h2 className="text-2xl font-bold mb-4">2. Use License</h2>
          <p className="text-muted-foreground mb-6">
            Permission is granted to temporarily download one copy of the materials (information or software) on FoodBase for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• Modify or copy the materials</li>
            <li>• Use the materials for any commercial purpose or for any public display</li>
            <li>• Attempt to decompile or reverse engineer any software contained on FoodBase</li>
            <li>• Remove any copyright or other proprietary notations from the materials</li>
            <li>• Transfer the materials to another person or "mirror" the materials on any other server</li>
            <li>• Use the materials for illegal purposes or in violation of any laws</li>
            <li>• Harass or cause distress or inconvenience to any person</li>
            <li>• Transmit obscene or offensive content</li>
            <li>• Disrupt the normal flow of dialogue within our website</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">3. Disclaimer</h2>
          <p className="text-muted-foreground mb-8">
            The materials on FoodBase are provided on an "as is" basis. FoodBase makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights. Further, FoodBase does not warrant or make any representations concerning the accuracy, likely results, or reliability of the use of the materials on its website or otherwise relating to such materials or on any sites linked to this site.
          </p>

          <h2 className="text-2xl font-bold mb-4">4. Limitations of Liability</h2>
          <p className="text-muted-foreground mb-8">
            In no event shall FoodBase or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on FoodBase, even if FoodBase or a FoodBase authorized representative has been notified orally or in writing of the possibility of such damage. In jurisdictions that do not allow the exclusion or limitation of liability for consequential or incidental damages, FoodBase's liability is limited to the amount you paid for the service.
          </p>

          <h2 className="text-2xl font-bold mb-4">5. Accuracy of Materials</h2>
          <p className="text-muted-foreground mb-8">
            The materials appearing on FoodBase could include technical, typographical, or photographic errors. FoodBase does not warrant that any of the materials on its website are accurate, complete, or current. FoodBase may make changes to the materials contained on its website at any time without notice. However, FoodBase does not make any commitment to update the materials.
          </p>

          <h2 className="text-2xl font-bold mb-4">6. Links</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by FoodBase of the site. Use of any such linked website is at the user's own risk. If you believe any linked site contains inappropriate content, please contact us immediately at support@foodbase.ng.
          </p>

          <h2 className="text-2xl font-bold mb-4">7. Modifications</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service. We will notify users of material changes via email or prominent notice on the website. Continued use after notification constitutes acceptance of revised terms.
          </p>

          <h2 className="text-2xl font-bold mb-4">8. Governing Law</h2>
          <p className="text-muted-foreground mb-8">
            These terms and conditions are governed by and construed in accordance with the laws of Nigeria, and you irrevocably submit to the exclusive jurisdiction of the courts located in Lagos, Nigeria.
          </p>

          <h2 className="text-2xl font-bold mb-4">9. Account Responsibilities</h2>
          <p className="text-muted-foreground mb-8">
            When you register for a FoodBase account, you are responsible for maintaining the confidentiality of your password and for all activities that occur under your account. You agree to accept responsibility for all activities that occur under your account and agree that you will not allow others to use your account. You must notify us immediately of any unauthorized use of your account. We are not liable for any loss or damage arising from your failure to comply with these requirements.
          </p>

          <h2 className="text-2xl font-bold mb-4">10. Acceptable Use</h2>
          <p className="text-muted-foreground mb-6">
            You agree not to use FoodBase for any unlawful purposes or in any way that could damage, disable, overburden, or impair the service. Prohibited behavior includes:
          </p>
          <ul className="text-muted-foreground text-sm space-y-3 mb-8">
            <li>• Harassment, threats, or defamation of any person</li>
            <li>• Uploading files containing viruses or malicious code</li>
            <li>• Attempting to gain unauthorized access to our systems</li>
            <li>• Engaging in any form of fraud or misrepresentation</li>
            <li>• Posting content that violates intellectual property rights</li>
            <li>• Spamming or sending unsolicited communications</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4">11. Intellectual Property Rights</h2>
          <p className="text-muted-foreground mb-8">
            All materials on FoodBase, including but not limited to text, graphics, logos, images, audio clips, digital downloads, and data compilations, are the property of FoodBase or its content suppliers and protected by international copyright laws. Your use of materials on FoodBase does not grant you ownership rights. You may not reproduce, distribute, transmit, or modify any materials without express written permission from FoodBase.
          </p>

          <h2 className="text-2xl font-bold mb-4">12. Payment Terms</h2>
          <p className="text-muted-foreground mb-8">
            All payments are processed securely through Paystack. By providing payment information, you authorize us to charge your account for the selected plan. Billing occurs on the date you select and on the anniversary of that date each month or year depending on your plan. You can cancel at any time, and no refunds will be issued for partial months except as provided in our Refund Policy. Price changes will be communicated 30 days in advance.
          </p>

          <h2 className="text-2xl font-bold mb-4">13. Limitation of Warranties</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase provides the service on an "as is" and "as available" basis. We do not guarantee that the service will be uninterrupted, timely, secure, or error-free. We do not warrant that the results obtained from the use of the service will meet your expectations or that any errors will be corrected.
          </p>

          <h2 className="text-2xl font-bold mb-4">14. Service Level Agreement</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase commits to maintaining 99.9% uptime for our services, measured on a monthly basis, excluding scheduled maintenance. In the event of service outages exceeding the guaranteed uptime, customers may be eligible for service credits. Please contact support@foodbase.ng for details on claiming service credits.
          </p>

          <h2 className="text-2xl font-bold mb-4">15. Termination</h2>
          <p className="text-muted-foreground mb-8">
            FoodBase may terminate or suspend your account and access to the service immediately, without prior notice or liability, if you breach any of these terms or engage in conduct that FoodBase believes violates applicable laws or harms other users. Upon termination, your right to use the service will cease immediately.
          </p>

          <h2 className="text-2xl font-bold mb-4">16. Contact Information</h2>
          <p className="text-muted-foreground mb-4">
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <div className="bg-primary/5 border border-border rounded-lg p-6">
            <p className="font-semibold mb-2">FoodBase Legal Team</p>
            <p className="text-sm text-muted-foreground">Email: legal@foodbase.ng</p>
            <p className="text-sm text-muted-foreground">Address: Lagos, Nigeria</p>
            <p className="text-sm text-muted-foreground">Response time: Within 5 business days</p>
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
