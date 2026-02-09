import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { updateTutorialCompletion } from '@/lib/api';
import { useAuth } from './AuthContext';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement: string; // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'drag' | 'scroll' | 'none';
  actionText?: string;
  skipable?: boolean;
}

export interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  isCompleted: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);


const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to the Chatbot Builder!',
    description: 'This tutorial will guide you through creating your first AI chatbot. Let\'s start by exploring the interface.',
    targetElement: '.tutorial-welcome',
    position: 'center',
    action: 'none',
    skipable: true
  },
  {
    id: 'block-palette',
    title: 'Block Library',
    description: 'This is your block library. Here you can find different types of blocks to build your chatbot workflow. Drag blocks from here to the canvas.',
    targetElement: '.block-palette',
    position: 'right',
    action: 'none',
    skipable: true
  },
  {
    id: 'canvas',
    title: 'Workflow Canvas',
    description: 'This is your main workspace. Drag blocks here to build your chatbot workflow.',
    targetElement: '.canvas-area',
    position: 'top-left',
    action: 'none',
    skipable: true
  },
  {
    id: 'system-prompt',
    title: 'Global Intelligence Block',
    description: 'This is your main system block. It defines how your chatbot behaves and responds. Click on it to customize it.',
    targetElement: '[data-block-id]:has(.rounded-full)',
    position: 'above',
    action: 'click',
    actionText: 'Click to edit',
    skipable: true
  },
  {
    id: 'add-context',
    title: 'Add Context Blocks',
    description: 'Add context blocks to give your chatbot knowledge. Drag a Website or Document block from the palette to connect it to the main block.',
    targetElement: '.placeholder-context',
    position: 'right',
    action: 'drag',
    actionText: 'Drag a context block here',
    skipable: true
  },
  {
    id: 'add-frontend',
    title: 'Frontend Interface',
    description: 'Customize what users see when they interact with your bot through the web interface',
    targetElement: '[data-block-id]',
    position: 'left',
    action: 'drag',
    actionText: 'Click on the frontend block here',
    skipable: true
  },
  {
    id: 'add-action',
    title: 'Add Actions',
    description: 'Add action blocks to give your chatbot capabilities like sending emails or browsing the internet.',
    targetElement: '.placeholder-action',
    position: 'above',
    action: 'drag',
    actionText: 'Drag an action block here',
    skipable: true
  },
  {
    id: 'test-mode',
    title: 'Test Your Chatbot',
    description: 'Use the "Test Mode" button to open your chatbot in a new tab and test how it works with real users.',
    targetElement: '.test-mode-button',
    position: 'bottom',
    action: 'click',
    actionText: 'Click to test',
    skipable: true
  },
  {
    id: 'settings',
    title: 'Chatbot Settings',
    description: 'Click the Settings button to configure your chatbot\'s name, description, and other options.',
    targetElement: '.settings-button',
    position: 'bottom',
    action: 'click',
    actionText: 'Click to open settings',
    skipable: true
  },
  {
    id: 'complete',
    title: 'Tutorial Complete!',
    description: 'You\'re all set! You now know how to build chatbots. Start by adding some context blocks and customizing your bot\'s behavior!',
    targetElement: null,
    position: 'center',
    action: 'none',
    skipable: false
  }
];

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const { user, token, updateUser } = useAuth();

  // Check if tutorial was completed from user data
  useEffect(() => {
    if (user) {
      setIsCompleted(user.tutorialCompleted || false);
    }
  }, [user]);

  const startTutorial = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTutorial();
    }
  }, [currentStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    completeTutorial();
  }, []);

  const completeTutorial = useCallback(async () => {
    setIsActive(false);
    setIsCompleted(true);
    
    // Update in database
    if (token) {
      try {
        const updatedUser = await updateTutorialCompletion(true, token);
        updateUser(updatedUser);
      } catch (error) {
        console.error('Failed to update tutorial completion:', error);
        // Still mark as completed locally even if API fails
      }
    }
  }, [token, updateUser]);

  const resetTutorial = useCallback(async () => {
    setIsActive(false);
    setCurrentStep(0);
    setIsCompleted(false);
    
    // Update in database
    if (token) {
      try {
        const updatedUser = await updateTutorialCompletion(false, token);
        updateUser(updatedUser);
      } catch (error) {
        console.error('Failed to reset tutorial completion:', error);
        // Still reset locally even if API fails
      }
    }
  }, [token, updateUser]);

  const value: TutorialContextType = {
    isActive,
    currentStep,
    steps: tutorialSteps,
    isCompleted,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    resetTutorial
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};