'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Register device with OneSignal via Median bridge
      if (navigator.userAgent.includes('median')) {
        setTimeout(() => {
          (window as any).median.onesignal.login(data.user.email)
            .then((result: any) => {
              console.log('[v0] OneSignal login result:', result);
              alert(`OneSignal Login Result: ${JSON.stringify(result)}`);
            })
            .catch((err: any) => {
              console.error('[v0] OneSignal login error:', err);
              alert(`OneSignal Login Error: ${JSON.stringify(err)}`);
            });
          (window as any).median.onesignal.tags.setTags({
            tags: { business_id: data.user.businessId }
          });
        }, 1000);
      }

      // Redirect based on role
      router.push(data.redirectUrl);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - Logo and messaging */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-accent p-8 flex-col justify-between text-white">
        <div className="flex items-center gap-3">
          <Image
            src="/foodbase-logo.png"
            alt="FoodBase"
            width={40}
            height={40}
          />
          <span className="text-xl font-bold">FoodBase</span>
        </div>

        <div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            Seamless Restaurant Management
          </h1>
          <p className="text-lg opacity-90">
            Accept orders, manage menus, and process payments effortlessly. Whether you're an admin overseeing the platform or a restaurant owner building your digital storefront, FoodBase has you covered.
          </p>
        </div>

        <div className="text-sm opacity-75">
          © {new Date().getFullYear()} FoodBase. All rights reserved, in conjunction with Wisdom Technologies.
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Image
              src="/foodbase-logo.png"
              alt="FoodBase"
              width={32}
              height={32}
            />
            <span className="font-bold text-primary">FoodBase</span>
          </div>

          <h2 className="text-2xl font-bold mb-1 text-foreground">Welcome Back</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Log in to access your dashboard
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-semibold">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label htmlFor="password" className="text-xs font-semibold">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:text-primary-dark font-medium"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 h-9 text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium mt-6"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            <p>Contact your administrator to register a new account</p>
          </div>
        </div>
      </div>
    </div>
  );
}
