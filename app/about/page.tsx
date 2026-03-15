import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Target, Lightbulb, Users, Heart } from 'lucide-react';

export const metadata = {
  title: 'About FoodBase - Our Story',
  description: 'Learn about FoodBase mission to empower restaurants',
};

export default function AboutPage() {
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

      {/* About Hero */}
      <section className="py-12 md:py-20 bg-primary/5 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Story</h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            FoodBase was born from a simple observation: restaurants in Nigeria deserve better technology to run their business efficiently and serve customers excellently.
          </p>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-sm max-w-none">
            <h2 className="text-2xl font-bold mb-6">How It All Started</h2>
            <p className="text-muted-foreground mb-6">
              In 2021, our founders were working with several restaurant owners across Lagos and observed a common problem: despite their incredible food and service, most restaurants were struggling with operational inefficiencies. They were managing orders through WhatsApp, tracking inventory on paper, manually calculating payments, and losing track of which dishes were popular.
            </p>
            <p className="text-muted-foreground mb-6">
              One founder's family restaurant was particularly affected. During the pandemic, they attempted digital transformation but found existing solutions were either too expensive, too complicated, or simply not designed for the Nigerian market. That's when the idea crystallized: create a platform specifically built for Nigerian restaurants that is affordable, easy to use, and tailored to their unique needs.
            </p>
            <p className="text-muted-foreground mb-8">
              FoodBase was launched in early 2022 with the first 10 restaurant partners. Within the first year, we had grown to over 200 active restaurants. Today, we're proud to serve thousands of restaurants across Nigeria, processing millions of orders and billions in naira in transactions annually.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div className="border border-border rounded-lg p-8">
              <Target className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Our Mission</h3>
              <p className="text-sm text-muted-foreground">
                To empower restaurant owners and staff with technology that simplifies operations, enables growth, and allows them to focus on what matters most: creating amazing food and delighting customers.
              </p>
            </div>
            <div className="border border-border rounded-lg p-8">
              <Lightbulb className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Our Vision</h3>
              <p className="text-sm text-muted-foreground">
                To become the backbone of the Nigerian restaurant industry, enabling every restaurant—from small family operations to large chains—to compete globally through technology and innovation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-12 md:py-20 bg-primary/5 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Our Core Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-border rounded-lg p-8">
              <Heart className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Restaurant-First</h3>
              <p className="text-sm text-muted-foreground">
                Every feature, every decision, every product update is made with the restaurant owner in mind. We listen to their challenges and build solutions that directly address their pain points. Our success is measured by their success.
              </p>
            </div>
            <div className="bg-white border border-border rounded-lg p-8">
              <Users className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Customer-Obsessed</h3>
              <p className="text-sm text-muted-foreground">
                We go above and beyond to ensure our customers succeed. This means responsive support, continuous improvement based on feedback, and proactive solutions to emerging problems. Your success is our priority.
              </p>
            </div>
            <div className="bg-white border border-border rounded-lg p-8">
              <Lightbulb className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Innovation</h3>
              <p className="text-sm text-muted-foreground">
                We continuously explore new technologies and methodologies to improve FoodBase. We stay ahead of industry trends and adapt to market changes. Innovation isn't a feature—it's our DNA.
              </p>
            </div>
            <div className="bg-white border border-border rounded-lg p-8">
              <Target className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-3">Integrity</h3>
              <p className="text-sm text-muted-foreground">
                We operate with complete transparency and honesty. Your data is sacred—we protect it fiercely. We're not out to trick anyone or hide fees. What you see is what you get, and we honor our commitments always.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Team</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            We're a diverse team of engineers, designers, business professionals, and restaurant enthusiasts passionate about transforming the Nigerian food service industry. Many of our team members have direct restaurant or food service experience, which deeply informs our product decisions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 mx-auto mb-4"></div>
              <h3 className="font-semibold mb-1">Olajide Okafor</h3>
              <p className="text-sm text-muted-foreground mb-3">Co-Founder & CEO</p>
              <p className="text-xs text-muted-foreground">
                Product visionary with 8 years in fintech and restaurants. Previously founded a successful restaurant chain.
              </p>
            </div>
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 mx-auto mb-4"></div>
              <h3 className="font-semibold mb-1">Amara Ezenweke</h3>
              <p className="text-sm text-muted-foreground mb-3">Co-Founder & CTO</p>
              <p className="text-xs text-muted-foreground">
                Full-stack engineer with expertise in building scalable systems. Former tech lead at major fintech companies.
              </p>
            </div>
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 mx-auto mb-4"></div>
              <h3 className="font-semibold mb-1">Chinedu Uwu</h3>
              <p className="text-sm text-muted-foreground mb-3">Chief Product Officer</p>
              <p className="text-xs text-muted-foreground">
                10+ years in product management. Passionate about creating intuitive user experiences for emerging markets.
              </p>
            </div>
          </div>

          <p className="text-muted-foreground text-center mt-12">
            Beyond our core team, we have talented developers, customer success managers, support specialists, and community advocates who are dedicated to making FoodBase the best platform for restaurants.
          </p>
        </div>
      </section>

      {/* Growth & Impact */}
      <section className="py-12 md:py-20 bg-primary/5 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Our Impact</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">2,500+</div>
              <p className="text-sm text-muted-foreground">Active Restaurants</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">5M+</div>
              <p className="text-sm text-muted-foreground">Orders Processed</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">₦2B+</div>
              <p className="text-sm text-muted-foreground">In Transactions</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">95%</div>
              <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* Looking Forward */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6">Looking Forward</h2>
          <p className="text-muted-foreground mb-6">
            We're just getting started. Over the next three years, we're planning to expand our product suite with advanced AI-powered features, enhanced analytics, customer loyalty programs, and integration with supply chain management systems. We're also expanding to West African countries while maintaining our commitment to the Nigerian market.
          </p>
          <p className="text-muted-foreground mb-6">
            We believe that technology should be an enabler, not a burden. As we grow, we remain committed to keeping FoodBase affordable, easy to use, and specifically designed for the needs of African restaurants. We want to help restaurants not just survive, but thrive and grow their businesses.
          </p>
          <p className="text-muted-foreground">
            If you're passionate about restaurants, technology, and African entrepreneurship, we'd love to hear from you. We're always looking for talented individuals to join our mission of transforming the food service industry.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-gradient-to-r from-primary to-accent text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-3">Join the FoodBase Revolution</h2>
          <p className="text-base opacity-90 mb-8 max-w-2xl mx-auto">
            Be part of a movement transforming how restaurants operate in Nigeria and across Africa.
          </p>
          <Link href="/login">
            <Button className="bg-white text-primary hover:bg-white/90 h-9 font-medium">
              Get Started Today
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-white py-12">
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
