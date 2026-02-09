import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const AuthPage = () => {
  const { login, register } = useAuth();
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.username, loginForm.password);
    } catch (error) {
      console.error('Login failed:', error);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register(registerForm.username, registerForm.password);
    } catch (error) {
      console.error('Registration failed:', error);
    }
    setLoading(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'microsoft' | 'sso') => {
    setLoading(true);
    
    // Frontend-only social login simulation
    try {
      // In a real app, this would redirect to the OAuth provider
      console.log(`Initiating ${provider} login...`);
      
      // Simulate OAuth flow with a mock user
      const mockUser = {
        username: `user@${provider}.com`,
        provider: provider,
        avatar: `https://ui-avatars.com/api/?name=${provider}&background=random`
      };
      
      // Store user data in localStorage for frontend-only approach
      localStorage.setItem('auth_user', JSON.stringify(mockUser));
      localStorage.setItem('auth_token', `mock-${provider}-token-${Date.now()}`);
      
      // Trigger login in our auth context
      await login(mockUser.username, 'social-login');
      
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
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200">
            <div className="w-8 h-8 bg-background rounded-lg animate-pulse"></div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
            Workflow Builder
          </h1>
          <p className="text-muted-foreground animate-slide-up animation-delay-400">
            Design and build intelligent workflows with visual blocks
          </p>
        </div>
        
        <Card className="border shadow-lg animate-slide-up animation-delay-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold">Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
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
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger 
                  value="login" 
                  className="data-[state=active]:bg-background transition-all duration-200"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="data-[state=active]:bg-background transition-all duration-200"
                >
                  Create Account
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="animate-fade-in">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Enter your username"
                      className="transition-all duration-200 focus:scale-[1.02]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
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
              </TabsContent>
              
              <TabsContent value="register" className="animate-fade-in">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Choose a username"
                      className="transition-all duration-200 focus:scale-[1.02]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Create a password"
                      className="transition-all duration-200 focus:scale-[1.02]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm your password"
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
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
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

export default AuthPage;