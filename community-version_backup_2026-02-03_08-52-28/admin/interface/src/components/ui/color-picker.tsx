import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface ColorPickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ColorPicker = React.forwardRef<HTMLInputElement, ColorPickerProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [color, setColor] = useState(value);

    useEffect(() => {
      setColor(value);
    }, [value]);

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setColor(e.target.value);
      onChange(e);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setColor(e.target.value);
      // Create a synthetic event for the parent onChange
      const syntheticEvent = {
        ...e,
        target: { ...e.target, value: e.target.value }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    };

    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={color}
            onChange={handleColorChange}
            className={`w-12 h-10 border-0 rounded-md cursor-pointer ${className}`}
            style={{
              padding: '0',
              backgroundColor: color,
            }}
            ref={ref}
            {...props}
          />
        </div>
        <Input
          type="text"
          value={color}
          onChange={handleTextChange}
          className="flex-1"
          placeholder="#RRGGBB"
        />
      </div>
    );
  }
);

ColorPicker.displayName = 'ColorPicker';

export { ColorPicker };
