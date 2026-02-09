import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Repeat, Zap, Sun, Moon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CronFrequencyOption {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  cronExpression: string;
}

const frequencyOptions: CronFrequencyOption[] = [
  {
    value: 'every-6-hours',
    label: 'Every 6 hours',
    description: 'Quarterly updates',
    icon: <Repeat className="h-4 w-4 text-green-500" />,
    cronExpression: '0 */6 * * *'
  },
  {
    value: 'daily-midnight',
    label: 'Daily at midnight',
    description: 'Once per day',
    icon: <Moon className="h-4 w-4 text-purple-500" />,
    cronExpression: '0 0 * * *'
  },
  {
    value: 'daily-morning',
    label: 'Daily at 9 AM',
    description: 'Morning updates',
    icon: <Sun className="h-4 w-4 text-orange-500" />,
    cronExpression: '0 9 * * *'
  },
  {
    value: 'weekly-monday',
    label: 'Weekly on Monday',
    description: 'Weekly updates',
    icon: <Calendar className="h-4 w-4 text-indigo-500" />,
    cronExpression: '0 0 * * 1'
  },
  {
    value: 'monthly',
    label: 'Monthly',
    description: 'Monthly updates',
    icon: <Calendar className="h-4 w-4 text-pink-500" />,
    cronExpression: '0 9 1 * *'
  },
  {
    value: 'custom',
    label: 'Custom schedule',
    description: 'Advanced cron expression',
    icon: <Clock className="h-4 w-4 text-gray-500" />,
    cronExpression: ''
  }
];

interface CronFrequencySelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const CronFrequencySelector: React.FC<CronFrequencySelectorProps> = ({
  value,
  onChange,
  className,
  disabled = false
}) => {
  const [selectedOption, setSelectedOption] = useState<string>(() => {
    // Find matching option based on current cron expression
    const matchingOption = frequencyOptions.find(option => 
      option.cronExpression === value && option.value !== 'custom'
    );
    return matchingOption ? matchingOption.value : 'custom';
  });

  const [customExpression, setCustomExpression] = useState<string>(
    selectedOption === 'custom' ? value : ''
  );

  // Update internal state when value prop changes (e.g., when switching between blocks)
  useEffect(() => {
    const matchingOption = frequencyOptions.find(option => 
      option.cronExpression === value && option.value !== 'custom'
    );
    const newSelectedOption = matchingOption ? matchingOption.value : 'custom';
    
    setSelectedOption(newSelectedOption);
    if (newSelectedOption === 'custom') {
      setCustomExpression(value);
    } else {
      setCustomExpression('');
    }
  }, [value]);

  const handleOptionChange = (optionValue: string) => {
    setSelectedOption(optionValue);
    
    if (optionValue === 'custom') {
      onChange(customExpression || '0 0 * * *');
    } else {
      const option = frequencyOptions.find(opt => opt.value === optionValue);
      if (option) {
        onChange(option.cronExpression);
      }
    }
  };

  const handleCustomExpressionChange = (expression: string) => {
    setCustomExpression(expression);
    if (selectedOption === 'custom') {
      onChange(expression || '0 0 * * *');
    }
  };

  const getNextRunTime = (cronExpression: string): string => {
    try {
      // This is a simplified calculation - in a real app you'd use a proper cron parser
      const now = new Date();
      const [minute, hour, day, month, dayOfWeek] = cronExpression.split(' ');
      
      const nextRun = new Date(now);
      
      if (minute.startsWith('*/')) {
        const interval = parseInt(minute.substring(2));
        const currentMinute = now.getMinutes();
        const nextMinute = Math.ceil(currentMinute / interval) * interval;
        if (nextMinute >= 60) {
          nextRun.setHours(nextRun.getHours() + 1);
          nextRun.setMinutes(nextMinute - 60);
        } else {
          nextRun.setMinutes(nextMinute);
        }
      } else if (minute !== '*') {
        nextRun.setMinutes(parseInt(minute));
        if (nextRun <= now) {
          nextRun.setHours(nextRun.getHours() + 1);
        }
      }
      
      if (hour.startsWith('*/')) {
        const interval = parseInt(hour.substring(2));
        const currentHour = now.getHours();
        const nextHour = Math.ceil(currentHour / interval) * interval;
        if (nextHour >= 24) {
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(nextHour - 24);
        } else {
          nextRun.setHours(nextHour);
        }
      } else if (hour !== '*') {
        nextRun.setHours(parseInt(hour));
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
      }
      
      return nextRun.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid schedule';
    }
  };

  const currentOption = frequencyOptions.find(opt => opt.value === selectedOption);
  const currentExpression = selectedOption === 'custom' ? customExpression : currentOption?.cronExpression || '0 0 * * *';

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label className="text-sm font-medium">Crawl Frequency</Label>
        <Select value={selectedOption} onValueChange={handleOptionChange} disabled={disabled}>
          <SelectTrigger className={`w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <SelectValue>
              {currentOption && (
                <div className="flex items-center space-x-2">
                  {currentOption.icon}
                  <span>{currentOption.label}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {frequencyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center space-x-3">
                  {option.icon}
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedOption === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="custom-cron" className="text-sm">
            Custom Cron Expression
          </Label>
          <div className="flex space-x-2">
            <Input
              id="custom-cron"
              placeholder="0 0 * * *"
              value={customExpression}
              onChange={(e) => handleCustomExpressionChange(e.target.value)}
              className={`flex-1 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={disabled}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCustomExpression('0 0 * * *');
                onChange('0 0 * * *');
              }}
            >
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Format: minute hour day month day-of-week (e.g., "0 9 * * 1" for Mondays at 9 AM)
          </p>
        </div>
      )}

      {currentExpression && (
        <div className="rounded-lg bg-muted/70 p-3 space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Schedule Preview</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <div>Cron expression: <code className="bg-background px-1 py-0.5 rounded text-xs">{currentExpression}</code></div>
            <div>Next run: {getNextRunTime(currentExpression)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CronFrequencySelector;