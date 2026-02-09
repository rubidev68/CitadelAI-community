import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { useTutorial } from '@/contexts/TutorialContext';

interface TutorialTriggerProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  onTutorialStart?: () => void;
}

const TutorialTrigger: React.FC<TutorialTriggerProps> = ({ 
  className = '', 
  variant = 'outline',
  size = 'sm',
  onTutorialStart
}) => {
  const { startTutorial, resetTutorial, isCompleted } = useTutorial();

  const handleStartTutorial = () => {
    startTutorial();
    onTutorialStart?.();
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={variant}
        size={size}
        onClick={handleStartTutorial}
        className={`flex items-center space-x-2 ${className}`}
      >
        <HelpCircle className="w-4 h-4" />
        <span>{isCompleted ? 'Tutorial' : 'Start Tutorial'}</span>
      </Button>
      
      {isCompleted && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetTutorial}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Reset tutorial"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

export default TutorialTrigger;