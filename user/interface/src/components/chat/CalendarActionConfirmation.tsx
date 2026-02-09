import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';

type DateTimeValue = 
  | string 
  | { old?: string; new?: string }
  | { old: string; new: string }
  | undefined;

interface CalendarActionConfirmationProps {
  isOpen: boolean;
  action: 'create' | 'update' | 'delete';
  eventDetails: {
    summary?: string;
    start?: DateTimeValue;
    end?: DateTimeValue;
    location?: string;
    attendees?: string[];
    eventId?: string;
  };
  confirmationToken: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export const CalendarActionConfirmation: React.FC<CalendarActionConfirmationProps> = ({
  isOpen,
  action,
  eventDetails,
  confirmationToken,
  onConfirm,
  onCancel,
  isConfirming = false,
}) => {
  const actionText = action === 'create' ? 'Create' : action === 'update' ? 'Update' : 'Delete';
  
  const formatDateTime = (dateTimeValue?: DateTimeValue): string => {
    if (!dateTimeValue) return 'Not specified';
    
    // Handle object format (for update operations: { old: '9:30p.m', new: '9p.m' })
    if (typeof dateTimeValue === 'object' && dateTimeValue !== null) {
      if (dateTimeValue.old && dateTimeValue.new) {
        return `${dateTimeValue.old} → ${dateTimeValue.new}`;
      } else if (dateTimeValue.new) {
        return dateTimeValue.new;
      } else if (dateTimeValue.old) {
        return dateTimeValue.old;
      }
      return 'Not specified';
    }
    
    // Handle string format
    if (typeof dateTimeValue === 'string') {
      try {
        // Try to parse as ISO date string
        const date = new Date(dateTimeValue);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString();
        }
        // If not a valid date, return as-is (might be a time string like "9p.m")
        return dateTimeValue;
      } catch (e) {
        return dateTimeValue;
      }
    }
    
    return String(dateTimeValue);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isConfirming && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Confirm Calendar Action
          </DialogTitle>
          <DialogDescription>
            The chatbot wants to {action} a calendar event. Please review the details below:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {eventDetails.summary && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Event Title</Label>
              <p className="text-sm text-muted-foreground">{eventDetails.summary}</p>
            </div>
          )}
          
          {(eventDetails.start || eventDetails.end) && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time
              </Label>
              <div className="space-y-1.5 pl-6">
                {eventDetails.start && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Start:</span>
                    <span className="text-sm text-foreground">{formatDateTime(eventDetails.start)}</span>
                  </div>
                )}
                {eventDetails.end && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground font-medium">End:</span>
                    <span className="text-sm text-foreground">{formatDateTime(eventDetails.end)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {eventDetails.location && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <p className="text-sm text-muted-foreground pl-6">{eventDetails.location}</p>
            </div>
          )}
          
          {eventDetails.attendees && eventDetails.attendees.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees
              </Label>
              <div className="space-y-1 pl-6">
                {eventDetails.attendees.map((attendee, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">{attendee}</p>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isConfirming}
            className={action === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {isConfirming ? (
              <>
                <span className="mr-2">Processing...</span>
              </>
            ) : (
              `Confirm ${actionText}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
