import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { loginUser, verifyTwoFactor, TwoFactorRequiredResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import TwoFactorStep from '@/components/TwoFactorStep';

const LoginPage = () => {
  const { login, user, setAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  useEffect(() => {
    // Clear any old tokens that might have been created with the old JWT secret
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await loginUser(form.email, form.password);
      
      // Check if 2FA is required
      if ('requiresTwoFactor' in response && (response as TwoFactorRequiredResponse).requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setTempToken((response as TwoFactorRequiredResponse).tempToken);
        setLoading(false);
        return;
      }

      // Normal login flow
      const success = await login(form.email, form.password);
      if (success) {
        navigate('/');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } catch (error: unknown) {
      console.error('Login failed:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error.response as { data?: { error?: string } })?.data?.error
        : error instanceof Error
        ? error.message
        : 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
    }
    setLoading(false);
  };

  const handleVerifyTwoFactor = async (otp: string, backupCode?: string) => {
    if (!tempToken) return;

    setError('');
    setLoading(true);

    try {
      const response = await verifyTwoFactor({
        tempToken,
        otp: backupCode ? undefined : otp,
        backupCode: backupCode
      });

      // Store token and user, and update auth context
      if ('token' in response && 'user' in response) {
        const userData = response.user as {
          id: string;
          email: string;
          name?: string;
          role: 'architect' | 'admin';
          provider?: 'email' | 'google' | 'microsoft' | 'sso';
          avatar?: string;
          company?: string;
          tutorialCompleted?: boolean;
          twoFactorEnabled?: boolean;
        };
        setAuth(response.token, userData);
        setLoading(false);
        navigate('/');
      } else {
        setError('Invalid response from server');
        setLoading(false);
      }
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : err instanceof Error
        ? err.message
        : 'Invalid code. Please try again.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.id]: e.target.value }));
    if (error) {
      setError('');
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'microsoft' | 'sso') => {
    setLoading(true);
    
    try {
      const mockUser = {
        email: `user@${provider}.com`,
        provider: provider,
        avatar: `https://ui-avatars.com/api/?name=${provider}&background=random`
      };
      
      localStorage.setItem('auth_user', JSON.stringify(mockUser));
      localStorage.setItem('auth_token', `mock-${provider}-token-${Date.now()}`);
      
      const success = await login(mockUser.email, 'social-login');
      if (success) {
        navigate('/');
      }
      
    } catch (error) {
      console.error(`${provider} login failed:`, error);
      alert(`${provider} login is not configured. This is a demo implementation.`);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200 overflow-hidden">
            <img 
              src="/logo-icon.png" 
              alt="CitadelAI Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
            Welcome Back
          </h1>
          <p className="text-muted-foreground animate-slide-up animation-delay-400">
            Sign in to access your chatbot dashboard
          </p>
        </div>
        
        <Card className="border shadow-lg animate-slide-up animation-delay-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Social Login Options */}
            <div className="space-y-3 mb-6">
              <Button 
                variant="outline" 
                className="w-full h-11 flex items-center justify-center space-x-2"
                disabled
                aria-disabled
                title="Social login is disabled"
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
                title="Social login is disabled"
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

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {requiresTwoFactor && tempToken ? (
              <TwoFactorStep
                tempToken={tempToken}
                onVerify={handleVerifyTwoFactor}
                onBack={() => {
                  setRequiresTwoFactor(false);
                  setTempToken(null);
                  setError('');
                }}
                error={error}
                loading={loading}
              />
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md animate-shake">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    className="transition-all duration-200 focus:scale-[1.02]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    className="transition-all duration-200 focus:scale-[1.02]"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            )}
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  Create one here
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

export default LoginPage;