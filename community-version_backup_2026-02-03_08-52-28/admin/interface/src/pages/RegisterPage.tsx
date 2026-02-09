
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { Bot, Server, AlertCircle } from 'lucide-react';
import { getTermsOfServiceUrl, getPrivacyPolicyUrl } from '@/utils/businessWebsiteUrl';

const RegisterPage = () => {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const { isFeatureEnabled, features } = useFeatureFlags();
  // Custom instance = proprietary edition with billing disabled (not community edition)
  const isCustomInstance = false;
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    // invitationCode removed
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Disable registration for custom instances
  if (isCustomInstance) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border shadow-lg">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Server className="w-8 h-8 text-purple-600" />
            </div>
            <CardTitle className="text-2xl font-semibold">Registration Disabled</CardTitle>
            <CardDescription>
              Custom Instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Admin account creation is disabled on custom instances. 
                Please contact your administrator or support team for account access.
              </AlertDescription>
            </Alert>
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                If you need assistance, please contact support.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" asChild>
                  <Link to="/login">Go to Login</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const success = await register(form.email, form.password, form.company, form.name, undefined);
      if (success) {
        navigate('/');
      }
    } catch (error) {
      console.error('Registration failed:', error);
    }
    setLoading(false);
  };

  const handleSocialRegister = async (provider: 'google' | 'microsoft' | 'sso') => {
    if (!form.company.trim()) {
      alert('Please enter your company name first');
      return;
    }

    setLoading(true);

    try {
      const mockUser = {
        email: `user@${provider}.com`,
        provider: provider,
        avatar: `https://ui-avatars.com/api/?name=${provider}&background=random`,
        company: form.company
      };

      localStorage.setItem('auth_user', JSON.stringify(mockUser));
      localStorage.setItem('auth_token', `mock-${provider}-token-${Date.now()}`);

      await register(mockUser.email, 'social-login', form.company);

    } catch (error) {
      console.error(`${provider} registration failed:`, error);
      alert(`${provider} login is not configured. This is a demo implementation.`);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200">
            <Bot className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
            Get Started
          </h1>
          <p className="text-muted-foreground animate-slide-up animation-delay-400">
            Create your account to start building chatbots
          </p>
        </div>

        <Card className="border shadow-lg animate-slide-up animation-delay-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold">Create Account</CardTitle>
            <CardDescription>
              Join us and start building intelligent chatbots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              
              
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Enter your company name"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Create a password"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                  data-testid="password-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your password"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                  data-testid="confirm-password-input"
                />
              </div>
              <div className="text-xs text-muted-foreground text-center">
                By creating an account, you agree to our{' '}
                <a href={getTermsOfServiceUrl()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Terms of Service
                </a>
                {' '}and{' '}
                <a href={getPrivacyPolicyUrl()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </div>
              <Button
                type="submit"
                className="w-full h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating account...</span>
                  </div>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Social Login Options */}
            <div className="space-y-3 mb-6">
              <Button
                variant="outline"
                className="w-full h-11 flex items-center justify-center space-x-2"
                disabled
                aria-disabled
                title="Social registration is disabled"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </Button>

              <Button
                variant="outline"
                className="w-full h-11 flex items-center justify-center space-x-2"
                disabled
                aria-disabled
                title="Social registration is disabled"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M0 0h11.5v11.5H0z"/>
                  <path fill="#00A4EF" d="M12.5 0H24v11.5H12.5z"/>
                  <path fill="#7FBA00" d="M0 12.5h11.5V24H0z"/>
                  <path fill="#FFB900" d="M12.5 12.5H24V24H12.5z"/>
                </svg>
                <span>Continue with Microsoft</span>
              </Button>

              <Button
                variant="outline"
                className="w-full h-11 flex items-center justify-center space-x-2"
                disabled
                aria-disabled
                title="SSO is disabled"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <circle cx="12" cy="16" r="1"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Continue with SSO</span>
              </Button>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Floating elements for visual appeal */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-secondary/10 rounded-full blur-xl animate-float animation-delay-1000"></div>
        <div className="absolute top-1/2 right-20 w-16 h-16 bg-accent/10 rounded-full blur-xl animate-float animation-delay-2000"></div>
      </div>
    </div>
  );
};

export default RegisterPage;
