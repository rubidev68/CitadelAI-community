import React, { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, CheckCircle, X } from 'lucide-react';
import { useRegistration } from '@/contexts/RegistrationContext';
import { useSearchParams } from 'react-router-dom';
import { verifyEmail, resendVerificationEmail } from '@/lib/api';

const Step2EmailVerification: React.FC = () => {
  const { registrationData, goToNextStep, goToPreviousStep, verifyEmail: verifyEmailInContext, canGoBack } = useRegistration();
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  // FORCE SKIP FOR COMMUNITY EDITION
  useEffect(() => {
    if (!registrationData.emailVerified) {
      console.log("Community Edition: Auto-verifying email step");
      verifyEmailInContext('community-edition-auto-verify');
      // verifyEmailInContext already sets step to 3, but just in case
    }
  }, [registrationData.emailVerified, verifyEmailInContext]);


  const handleEmailVerification = useCallback(async (token: string) => {
    setIsVerifying(true);
    setVerificationError('');

    try {
      const result = await verifyEmail(token);
      
      if (result.emailVerified) {
        // If verification successful, update state
        verifyEmailInContext(token);
      } else {
        setVerificationError('Verification failed. Please try again.');
      }
    } catch (error: unknown) {
      let errorMessage = 'Invalid or expired verification link. Please try again.';
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
      setVerificationError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  }, [verifyEmailInContext]);

  // Check for verification token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !registrationData.emailVerified) {
      handleEmailVerification(token);
    }
  }, [searchParams, registrationData.emailVerified, handleEmailVerification]);

  const handleNext = () => {
    goToNextStep();
  };

  const handleBack = () => {
    goToPreviousStep();
  };

  const handleResendEmail = async () => {
    if (!registrationData.email) {
      setVerificationError('Email address is required');
      return;
    }

    setIsResending(true);
    setVerificationError('');
    setResendSuccess(false);

    try {
      await resendVerificationEmail(registrationData.email);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000); // Hide success message after 5 seconds
    } catch (error: unknown) {
      let errorMessage = 'Failed to resend verification email. Please try again.';
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
      setVerificationError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };


  // Show verification success state
  if (registrationData.emailVerified) {
    return (
      <div className="w-full mx-auto" style={{ width: '512px', maxWidth: '512px' }}>
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
            Email Verified!
          </h1>
          <p className="text-muted-foreground animate-slide-up animation-delay-400">
            Your email has been successfully verified
          </p>
        </div>
        
        <Card className="border shadow-lg animate-slide-up animation-delay-500 w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold">Verification Complete</CardTitle>
            <CardDescription>
              You can now continue with your registration
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                Your email <strong>{registrationData.email}</strong> has been verified successfully.
              </p>
              
              <Button
                onClick={handleNext}
                className="w-full h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              >
                Continue Registration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification in progress state
  if (isVerifying) {
    return (
      <div className="w-full mx-auto" style={{ width: '512px', maxWidth: '512px' }}>
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200">
            <div className="w-8 h-8 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
            Verifying Email...
          </h1>
          <p className="text-muted-foreground animate-slide-up animation-delay-400">
            Please wait while we verify your email
          </p>
        </div>
        
        <Card className="border shadow-lg animate-slide-up animation-delay-500 w-full">
          <CardContent className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Verifying your email address...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto" style={{ width: '512px', maxWidth: '512px' }}>
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200">
          <Mail className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
          Verify Your Email
        </h1>
        <p className="text-muted-foreground animate-slide-up animation-delay-400">
          We've sent a verification link to your email address
        </p>
      </div>
      
      <Card className="border shadow-lg animate-slide-up animation-delay-500 w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Check Your Email</CardTitle>
          <CardDescription>
            Please verify your email address to continue
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            {verificationError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md animate-shake">
                <div className="flex items-center space-x-2">
                  <X className="w-4 h-4" />
                  <span>{verificationError}</span>
                </div>
              </div>
            )}

            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-10 h-10 text-blue-600" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                We've sent a verification email to:
              </p>
              <p className="font-medium text-foreground mb-4">
                {registrationData.email}
              </p>
              <p className="text-sm text-muted-foreground">
                Click the verification link in the email to continue with your registration.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Didn't receive the email?</p>
                <ul className="space-y-1 text-xs">
                  <li>• Check your spam or junk folder</li>
                  <li>• Make sure the email address is correct</li>
                  <li>• Wait a few minutes for the email to arrive</li>
                </ul>
              </div>
            </div>

            <div className="text-center space-y-3">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleResendEmail();
                }}
                variant="outline"
                className="text-sm"
                disabled={isResending}
              >
                {isResending ? 'Sending...' : 'Resend verification email'}
              </Button>
              
              {resendSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded-md">
                  Verification email sent! Please check your inbox.
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            {canGoBack(2) && (
              <Button
                onClick={handleBack}
                variant="outline"
                className="flex-1 h-11 transition-all duration-200 hover:scale-[1.02]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!registrationData.emailVerified}
              className={`${canGoBack(2) ? 'flex-1' : 'w-full'} h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              I've verified my email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step2EmailVerification;