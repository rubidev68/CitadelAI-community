import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Key } from 'lucide-react';
import { useRegistration } from '@/contexts/RegistrationContext';
import { registerUser } from '@/lib/api';
import { getTermsOfServiceUrl, getPrivacyPolicyUrl } from '@/utils/businessWebsiteUrl';

const Step1Auth: React.FC = () => {
  const { registrationData, updateRegistrationData, goToNextStep, canProceed, goToStep } = useRegistration();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateRegistrationData({ email: e.target.value });
    if (error) setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateRegistrationData({ password: e.target.value });
    if (error) setError('');
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (error) setError('');
  };

  

  const handleNext = async () => {
    if (registrationData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (registrationData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Register the user account (this will send verification email)
    setIsRegistering(true);
    setError('');
    
    try {
      // Register with email, password, and invitation code - company and name will be added later
      await registerUser(
        registrationData.email,
        registrationData.password,
        undefined, // company - will be added in step 3
        undefined, // name - will be added in step 4
        undefined
      );
      
      // Skip email verification step
      updateRegistrationData({ emailVerified: true });
      goToStep(3);
    } catch (error: unknown) {
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
          const responseData = error.response.data as { error?: string };
          if (responseData?.error) {
            errorMessage = responseData.error;
          }
        } else if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  return (
    <div className="w-full mx-auto" style={{ width: '512px', maxWidth: '512px' }}>
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200 overflow-hidden">
          <img 
            src="/logo-icon.png" 
            alt="CitadelAI Logo" 
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
          Create Your Account
        </h1>
        <p className="text-muted-foreground animate-slide-up animation-delay-400">
          Let's start with your basic account information
        </p>
      </div>
      
      <Card className="border shadow-lg animate-slide-up animation-delay-500 w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Account Setup</CardTitle>
          <CardDescription>
            Enter your email and create a password
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md animate-shake mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={registrationData.email}
                onChange={handleEmailChange}
                placeholder="Enter your email address"
                className="transition-all duration-200 focus:scale-[1.02]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={registrationData.password}
                  onChange={handlePasswordChange}
                  placeholder="Create a strong password"
                  className="pr-10 transition-all duration-200 focus:scale-[1.02]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Confirm your password"
                  className="pr-10 transition-all duration-200 focus:scale-[1.02]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center mt-4">
            By creating an account, you agree to our{' '}
            <a href={getTermsOfServiceUrl()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href={getPrivacyPolicyUrl()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </div>

          <div className="flex space-x-3 mt-6">
            <Button
              onClick={() => {}} // No-op for first step
              variant="outline"
              className="flex-1 h-11 transition-all duration-200 hover:scale-[1.02] opacity-50 cursor-not-allowed"
              disabled
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed(1) || !confirmPassword || registrationData.password !== confirmPassword || isRegistering}
              className="flex-1 h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isRegistering ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating account...</span>
                </div>
              ) : (
                'Continue'
              )}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-primary hover:underline font-medium">
                Sign in here
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step1Auth;