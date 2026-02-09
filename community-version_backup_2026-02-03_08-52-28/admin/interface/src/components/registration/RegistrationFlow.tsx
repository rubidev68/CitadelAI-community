import React, { useState, useEffect } from 'react';
import { useRegistration } from '@/contexts/RegistrationContext';
import Step1Auth from './Step1Auth';
import Step2EmailVerification from './Step2EmailVerification';
import Step3Company from './Step3Company';
import Step4Personal from './Step4Personal';
import Step5Chatbot from './Step5Chatbot';
import { Progress } from '@/components/ui/progress';
import { CheckCircle } from 'lucide-react';
import { getTermsOfServiceUrl, getPrivacyPolicyUrl } from '@/utils/businessWebsiteUrl';

const RegistrationFlow: React.FC = () => {
  const { currentStep, totalSteps } = useRegistration();
  const [animationDirection, setAnimationDirection] = useState<'right' | 'left'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousStep, setPreviousStep] = useState(currentStep);

  // Track step changes for animation direction
  useEffect(() => {
    if (currentStep !== previousStep) {
      setAnimationDirection(currentStep > previousStep ? 'right' : 'left');
      setPreviousStep(currentStep);
      setIsAnimating(true);
      
      // Reset animation state after animation completes
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentStep, previousStep]);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Auth />;
      case 2:
        return <Step2EmailVerification />;
      case 3:
        return <Step3Company />;
      case 4:
        return <Step4Personal />;
      case 5:
        return <Step5Chatbot />;
      default:
        return <Step1Auth />;
    }
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1:
        return 'Account Setup';
      case 2:
        return 'Email Verification';
      case 3:
        return 'Company Info';
      case 4:
        return 'Personal Info';
      case 5:
        return 'First Chatbot';
      default:
        return '';
    }
  };

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Progress Header */}
      <div className="w-full mx-auto mb-8" style={{ width: '512px', maxWidth: '512px' }}>
        <div className="flex items-center justify-between mb-4">
          {Array.from({ length: totalSteps }, (_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            
            return (
              <div key={stepNumber} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500 transform ${
                    isCompleted
                      ? 'bg-black text-white'
                      : isCurrent
                      ? 'bg-black text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 animate-fade-in-up" />
                  ) : (
                    <span className="animate-fade-in-up">{stepNumber}</span>
                  )}
                </div>
                <span
                  className={`text-xs mt-2 font-medium transition-all duration-300 ${
                    isCompleted || isCurrent
                      ? 'text-black font-semibold'
                      : 'text-gray-400'
                  }`}
                >
                  {getStepTitle(stepNumber)}
                </span>
              </div>
            );
          })}
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-black rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}: {getStepTitle(currentStep)}
          </p>
        </div>
      </div>

      {/* Step Content */}
      <div className="w-full flex justify-center">
        <div 
          key={currentStep}
          className={`transition-all duration-500 ease-in-out transform ${
            isAnimating 
              ? animationDirection === 'right' 
                ? 'animate-slide-in-right' 
                : 'animate-slide-in-left'
              : 'animate-fade-in-up'
          }`}
        >
          {renderStep()}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{' '}
          <a href={getTermsOfServiceUrl()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={getPrivacyPolicyUrl()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default RegistrationFlow;