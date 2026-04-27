import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Lock, Shield, Eye, Server, AlertCircle, CheckCircle } from 'lucide-react';

export const metadata = {
  title: 'Security - FoodBase',
  description: 'Enterprise-grade security and compliance standards',
};

export default function SecurityPage() {
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

      {/* Security Header */}
      <section className="py-12 md:py-20 bg-primary/5 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Security is Our Priority</h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            FoodBase is built with enterprise-grade security measures to protect your restaurant's data and your customers' sensitive information.
          </p>
        </div>
      </section>

      {/* Key Security Features */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="border border-border rounded-lg p-8">
              <Lock className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">End-to-End Encryption</h3>
              <p className="text-sm text-muted-foreground mb-4">
                All data in transit is encrypted using industry-standard TLS 1.3 encryption. Customer payment information and sensitive business data are protected with 256-bit AES encryption at rest, ensuring maximum security even if systems are compromised.
              </p>
            </div>
            <div className="border border-border rounded-lg p-8">
              <Shield className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">PCI DSS Compliance</h3>
              <p className="text-sm text-muted-foreground mb-4">
                FoodBase is compliant with PCI Data Security Standard (PCI DSS) Level 1, the highest level of compliance. Through our integration with Paystack, all payment card data is processed securely without ever being stored on our servers.
              </p>
            </div>
            <div className="border border-border rounded-lg p-8">
              <Eye className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Role-Based Access Control</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Implement granular permissions with role-based access control (RBAC). Assign specific roles to team members—owner, manager, or staff—and control exactly what features each role can access, ensuring sensitive data remains restricted.
              </p>
            </div>
            <div className="border border-border rounded-lg p-8">
              <Server className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Secure Infrastructure</h3>
              <p className="text-sm text-muted-foreground mb-4">
                FoodBase is hosted on secure cloud infrastructure with automated backups, redundancy, and disaster recovery. Our data centers are located in compliant regions with physical security controls, environmental monitoring, and 24/7 surveillance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Security Practices */}
      <section className="py-12 md:py-20 bg-primary/5 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Our Security Practices</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Authentication & Authorization
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                FoodBase implements multi-factor authentication (MFA) for all user accounts. We support both SMS and authenticator app-based MFA. Passwords are hashed using bcrypt with strong salt values, and sessions are managed securely with HTTP-only cookies that expire after periods of inactivity.
              </p>
              <p className="text-sm text-muted-foreground">
                Admin accounts receive additional security measures including mandatory MFA, IP whitelisting options, and detailed login activity logs that you can monitor in real-time.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Data Privacy & GDPR Compliance
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                We are committed to data privacy and are fully compliant with GDPR requirements. All personal data collected is processed lawfully, transparently, and only for specified purposes. Users have the right to access, correct, and delete their personal data.
              </p>
              <p className="text-sm text-muted-foreground">
                FoodBase provides tools for data export and deletion requests. We maintain detailed records of all data processing activities and conduct regular privacy impact assessments to ensure compliance with evolving regulations.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Penetration Testing & Vulnerability Assessment
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                FoodBase undergoes regular penetration testing by independent third-party security firms at least quarterly. We employ both manual and automated vulnerability scanning tools to identify and remediate security weaknesses before they can be exploited.
              </p>
              <p className="text-sm text-muted-foreground">
                We maintain a responsible disclosure program and encourage the security community to report vulnerabilities through our dedicated security@foodbase.ng email address, which we monitor continuously.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Regular Security Updates & Patches
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                All software dependencies are continuously monitored for known vulnerabilities using automated security scanning tools. Security patches are applied immediately and thoroughly tested before deployment to production environments.
              </p>
              <p className="text-sm text-muted-foreground">
                We maintain a detailed changelog of all security updates and critical patches. System updates are deployed with zero-downtime strategies to ensure service continuity and reliability for our users.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Audit Logging & Monitoring
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Every action within FoodBase is logged and timestamped, creating a complete audit trail for compliance and investigation purposes. Logs include user actions, data modifications, access attempts, and configuration changes with full context.
              </p>
              <p className="text-sm text-muted-foreground">
                Our 24/7 monitoring systems track all system activities in real-time. Suspicious activities trigger automated alerts, and our security team investigates anomalies immediately to prevent potential security incidents or breaches.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Incident Response & Business Continuity
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                FoodBase has a comprehensive incident response plan in place with defined procedures for detecting, containing, and remediating security incidents. Our team includes certified security professionals trained to respond to threats quickly and effectively.
              </p>
              <p className="text-sm text-muted-foreground">
                We maintain 99.9% uptime with redundant systems, automated failover, and geographic distribution of infrastructure. Regular disaster recovery drills ensure we can recover from any incident and restore service within minutes.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Employee Security Training
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                All FoodBase employees receive mandatory security training when joining the company and undergo annual refresher training. We emphasize secure coding practices, data handling procedures, and phishing awareness to maintain our security posture.
              </p>
              <p className="text-sm text-muted-foreground">
                Employees with access to customer data sign strict confidentiality agreements and undergo background checks. Access is granted on a need-to-know basis with regular audits to ensure access rights remain appropriate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-center">Compliance & Certifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-2">PCI DSS Level 1</h4>
              <p className="text-sm text-muted-foreground">
                Highest level of compliance for payment card data security. Verified and audited annually.
              </p>
            </div>
            <div className="border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-2">GDPR Compliant</h4>
              <p className="text-sm text-muted-foreground">
                Full compliance with General Data Protection Regulation for European user data.
              </p>
            </div>
            <div className="border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-2">SOC 2 Type II</h4>
              <p className="text-sm text-muted-foreground">
                Independent audit confirms our security and operational controls meet industry standards.
              </p>
            </div>
            <div className="border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-2">ISO 27001</h4>
              <p className="text-sm text-muted-foreground">
                International standard certification for information security management systems.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Security Team */}
      <section className="py-12 md:py-16 bg-gradient-to-r from-primary to-accent text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-3">Security Questions or Concerns?</h2>
          <p className="text-base opacity-90 mb-8 max-w-2xl mx-auto">
            Our security team is here to help. Contact us with any security-related questions or to report vulnerabilities.
          </p>
          <Button className="bg-white text-primary hover:bg-white/90 h-9 font-medium">
            Contact Security Team
          </Button>
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
