import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, SkipForward, HelpCircle } from 'lucide-react';
import { useTutorial } from '@/contexts/TutorialContext';

interface TutorialBubbleProps {
  step: number;
}

const TutorialBubble: React.FC<TutorialBubbleProps> = ({ step }) => {
  const { 
    steps, 
    currentStep, 
    nextStep, 
    previousStep, 
    skipTutorial, 
    isActive 
  } = useTutorial();
  
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousStep();
          break;
        case 'Escape':
          e.preventDefault();
          skipTutorial();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, previousStep, skipTutorial]);

  const currentStepData = steps[currentStep];

  // Handle step transitions with animation
  useEffect(() => {
    if (!isActive || !currentStepData) return;
    
    // Simple approach - just show the bubble
    setShowBubble(true);
    setIsExiting(false);
  }, [currentStep, isActive, currentStepData]);

  // Set showBubble to true when tutorial becomes active
  useEffect(() => {
    if (isActive) {
      setShowBubble(true);
    }
  }, [isActive]);

  // Calculate bubble position based on target element
  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const updatePosition = () => {
      let targetElement: HTMLElement | null = null;

      // Special handling for system prompt block
      if (currentStepData.id === 'system-prompt') {
        const blocks = document.querySelectorAll('[data-block-id]');
        for (const block of blocks) {
          const innerDiv = block.querySelector('.rounded-full');
          if (innerDiv) {
            targetElement = block as HTMLElement;
            break;
          }
        }
      } else if (currentStepData.id === 'add-frontend') {
        // Find the frontend block (not rounded-full, so it's rectangular)
        const blocks = document.querySelectorAll('[data-block-id]');
        for (const block of blocks) {
          const innerDiv = block.querySelector('.rounded-lg');
          if (innerDiv) {
            targetElement = block as HTMLElement;
            break;
          }
        }
    } else {
      if (currentStepData.targetElement) {
        targetElement = document.querySelector(currentStepData.targetElement) as HTMLElement;
      } else {
        targetElement = null; // For center-only bubbles like complete
      }
    }

      if (!targetElement) {
        // If target element not found, center the bubble
        setPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
        setIsVisible(true);
        return;
      }

      targetRef.current = targetElement;
      const rect = targetElement.getBoundingClientRect();
      const bubble = bubbleRef.current;
      
      if (!bubble) return;

      const bubbleRect = bubble.getBoundingClientRect();
      const padding = 20;
      let x = 0;
      let y = 0;

      switch (currentStepData.position) {
        case 'top':
          x = rect.left + rect.width / 2 - bubbleRect.width / 2;
          y = rect.top - bubbleRect.height - padding;
          break;
        case 'bottom':
          x = rect.left + rect.width / 2 - bubbleRect.width / 2;
          y = rect.bottom + padding;
          if (currentStepData.id === 'test-mode') {
            console.log('Bottom position calculation:', {
              rectLeft: rect.left,
              rectWidth: rect.width,
              rectCenter: rect.left + rect.width / 2,
              bubbleWidth: bubbleRect.width,
              calculatedX: x,
              finalX: x
            });
          }
          break;
        case 'left':
          x = rect.left - bubbleRect.width - padding;
          y = rect.top + rect.height / 2;
          // If bubble would go off screen, position it to the right instead
          if (x < padding) {
            x = rect.right + padding;
          }
          break;
        case 'right':
          x = rect.right + padding;
          y = rect.top + rect.height / 2 - bubbleRect.height / 2;
          // If bubble would go off screen, position it to the left instead
          if (x + bubbleRect.width > window.innerWidth - padding) {
            x = rect.left - bubbleRect.width - padding;
          }
          break;
        case 'top-left':
          x = rect.left + padding;
          y = rect.top + padding;
          break;
        case 'above':
          x = rect.left + rect.width / 2;
          y = rect.top - padding;
          break;
        case 'center':
          x = window.innerWidth / 2 - bubbleRect.width / 2;
          y = window.innerHeight / 2 - bubbleRect.height / 2;
          break;
      }

      // Ensure bubble stays within viewport
      x = Math.max(padding, Math.min(x, window.innerWidth - bubbleRect.width - padding));
      y = Math.max(padding, Math.min(y, window.innerHeight - bubbleRect.height - padding));

      setPosition({ x, y });
      setIsVisible(true);
      
      if (currentStepData.id === 'test-mode') {
        console.log('Final bubble position:', { x, y, bubbleWidth: bubbleRect.width, bubbleHeight: bubbleRect.height });
      }
    };

    // Small delay to ensure DOM is updated
    const timer = setTimeout(updatePosition, 200);
    
    // Update position on scroll and resize
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, currentStepData, currentStep]);

  // Highlight target element
  useEffect(() => {
    if (!isActive || !currentStepData) return;

    let targetElement: HTMLElement | null = null;

    // Special handling for system prompt block
    if (currentStepData.id === 'system-prompt') {
      // Find the system prompt block by looking for a block with rounded-full class
      const blocks = document.querySelectorAll('[data-block-id]');
      for (const block of blocks) {
        const innerDiv = block.querySelector('.rounded-full');
        if (innerDiv) {
          targetElement = block as HTMLElement;
          break;
        }
      }
    } else if (currentStepData.id === 'add-frontend') {
      // Find the frontend block (not rounded-full, so it's rectangular)
      const blocks = document.querySelectorAll('[data-block-id]');
      for (const block of blocks) {
        const innerDiv = block.querySelector('.rounded-lg');
        if (innerDiv) {
          targetElement = block as HTMLElement;
          break;
        }
      }
    } else {
      targetElement = document.querySelector(currentStepData.targetElement) as HTMLElement;
      if (currentStepData.id === 'test-mode') {
        console.log('Test mode button element:', targetElement);
        console.log('Button rect:', targetElement?.getBoundingClientRect());
      }
    }

    if (targetElement) {
      // Get the element's position for the cutout
      const rect = targetElement.getBoundingClientRect();
      
      // Add padding to make the bright area larger
      const padding = 10;
      const expandedRect = {
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        right: Math.min(window.innerWidth, rect.right + padding),
        bottom: Math.min(window.innerHeight, rect.bottom + padding),
        width: rect.width + (padding * 2),
        height: rect.height + (padding * 2)
      };
      
      setHighlightRect(expandedRect);
      
      // Don't change position, just add z-index and highlighting
      targetElement.style.zIndex = '10001'; // Higher than overlay to ensure visibility
      targetElement.classList.add('tutorial-highlight');
      
      // Add pulsing animation
      targetElement.style.animation = 'tutorial-pulse 2s infinite';
    } else {
      setHighlightRect(null);
    }

    return () => {
      if (targetElement) {
        targetElement.classList.remove('tutorial-highlight');
        targetElement.style.animation = '';
        targetElement.style.zIndex = '';
      }
      setHighlightRect(null);
    };
  }, [isActive, currentStepData, currentStep]);

  if (!isActive || !currentStepData || !isVisible || !showBubble) return null;


  return (
    <>
      {/* Overlay with cutout - single approach */}
      {highlightRect ? (
        <div 
          className="fixed pointer-events-none" 
          style={{ 
            zIndex: 9998,
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            background: 'transparent',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '12px',
            transition: 'all 0.3s ease-in-out'
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/50 z-[9998] pointer-events-none tutorial-overlay" />
      )}
      
      {/* Tutorial Bubble */}
      <div
        ref={bubbleRef}
        className={`fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-sm p-6 pointer-events-auto tutorial-bubble ${isExiting ? 'tutorial-bubble-exit' : ''}`}
        style={{
          left: position.x,
          top: position.y,
          zIndex: 10002,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: currentStepData.position === 'right' ? 'none' : 
                    currentStepData.position === 'left' ? 'translateY(-50%)' :
                    currentStepData.position === 'bottom' ? 'none' :
                    currentStepData.position === 'top-left' ? 'none' : 
                    currentStepData.position === 'above' ? 'translate(-50%, -100%)' :
                    currentStepData.position === 'center' ? 'translate(-50%, -50%)' :
                    'translate(-50%, -50%)',
        }}
      >
        {/* Arrow pointing to target */}
        {currentStepData.position !== 'center' && currentStepData.position !== 'top-left' && (
          <div
            className={`absolute w-0 h-0 border-8 border-transparent ${
              currentStepData.position === 'top' ? 'border-t-white dark:border-t-gray-800 -bottom-4 left-1/2 -translate-x-1/2' :
              currentStepData.position === 'bottom' ? 'border-b-white dark:border-b-gray-800 -top-4 left-1/2 -translate-x-1/2' :
              currentStepData.position === 'above' ? 'border-t-white dark:border-t-gray-800 -bottom-4 left-1/2 -translate-x-1/2' :
              currentStepData.position === 'left' ? 'border-l-white dark:border-l-gray-800 -right-4 top-1/2 -translate-y-1/2' :
              'border-r-white dark:border-r-gray-800 -left-4 top-1/2 -translate-y-1/2'
            }`}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={skipTutorial}
            className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1"
          >
            <SkipForward className="w-4 h-4" />
            <span className="text-xs">Skip</span>
          </Button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {currentStepData.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            {currentStepData.description}
          </p>
          {currentStepData.actionText && (
            <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                💡 {currentStepData.actionText}
              </p>
            </div>
          )}
          {currentStep === 0 && (
            <div className="mt-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 Use <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">←</kbd> <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">→</kbd> or <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">Space</kbd> to navigate • <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">Esc</kbd> to skip
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousStep}
              disabled={currentStep === 0}
              className="flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </Button>
            
          </div>

          <Button
            onClick={nextStep}
            size="sm"
            className="flex items-center space-x-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <span>{currentStep === steps.length - 1 ? 'Finish' : 'Next'}</span>
            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* CSS for highlighting and animations */}
      <style jsx>{`
        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          }
        }
        
        .tutorial-highlight {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
};

export default TutorialBubble;