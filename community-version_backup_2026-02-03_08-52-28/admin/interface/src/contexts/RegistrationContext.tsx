import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface RegistrationData {
  // Step 1: Basic Auth
  email: string;
  password: string;
  invitationCode: string;
  
  // Step 2: Email Verification
  emailVerified: boolean;
  verificationToken?: string;
  
  // Step 3: Company Info
  company: string;
  
  // Step 4: Personal Info
  name: string;
  
  // Step 5: First Chatbot
  chatbotName: string;
  chatbotDescription?: string;
}

export interface RegistrationContextType {
  currentStep: number;
  totalSteps: number;
  registrationData: RegistrationData;
  isComplete: boolean;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: number) => void;
  updateRegistrationData: (data: Partial<RegistrationData>) => void;
  resetRegistration: () => void;
  canProceed: (step: number) => boolean;
  canGoBack: (step: number) => boolean;
  verifyEmail: (token: string) => void;
}

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

const STORAGE_KEY = 'citadel_registration_data';
const TOTAL_STEPS = 5;

const defaultRegistrationData: RegistrationData = {
  email: '',
  password: '',
  invitationCode: '',
  emailVerified: false,
  verificationToken: '',
  company: '',
  name: '',
  chatbotName: '',
  chatbotDescription: '',
};

export const RegistrationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationData, setRegistrationData] = useState<RegistrationData>(defaultRegistrationData);
  const [isComplete, setIsComplete] = useState(false);

  // Load saved data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setRegistrationData(parsed);
        
        // Determine current step based on filled data
        let step = 1;
        if (parsed.email && parsed.password) { step = 3; parsed.emailVerified = true; } // Email verification step
        if (parsed.emailVerified) step = 3; // After email verification, go to company
        if (parsed.company) step = 4;
        if (parsed.name) step = 5;
        if (parsed.chatbotName) step = 5; // Stay on step 5 until completion
        
        setCurrentStep(step);
      } catch (error) {
        console.error('Failed to parse saved registration data:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registrationData));
  }, [registrationData]);

  const updateRegistrationData = (data: Partial<RegistrationData>) => {
    setRegistrationData(prev => ({ ...prev, ...data }));
  };

  const goToNextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const goToPreviousStep = () => {
    if (canGoBack(currentStep)) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  };

  const resetRegistration = () => {
    setRegistrationData(defaultRegistrationData);
    setCurrentStep(1);
    setIsComplete(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(registrationData.email && registrationData.password);
      case 2:
        return registrationData.emailVerified; // Email verification step - only proceed if verified
      case 3:
        return !!(registrationData.company);
      case 4:
        return !!(registrationData.name);
      case 5:
        return !!(registrationData.chatbotName);
      default:
        return false;
    }
  };

  const canGoBack = (step: number): boolean => {
    // Once email is verified, can't go back to steps 1 or 2
    if (registrationData.emailVerified && step <= 2) {
      return false;
    }
    return step > 1;
  };

  const verifyEmail = (token: string) => {
    updateRegistrationData({ 
      emailVerified: true, 
      verificationToken: token 
    });
    // Automatically advance to next step after verification
    setCurrentStep(3);
  };

  const value: RegistrationContextType = {
    currentStep,
    totalSteps: TOTAL_STEPS,
    registrationData,
    isComplete,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    updateRegistrationData,
    resetRegistration,
    canProceed,
    canGoBack,
    verifyEmail,
  };

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
};

export const useRegistration = (): RegistrationContextType => {
  const context = useContext(RegistrationContext);
  if (context === undefined) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
};