import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, MessageSquare, Building, Sparkles, HelpCircle, Lightbulb, Search } from 'lucide-react';

interface QuestionSuggestion {
  id: string;
  text: string;
  icon: string;
}

interface QuestionSuggestionsConfigProps {
  suggestions: QuestionSuggestion[];
  onUpdate: (suggestions: QuestionSuggestion[]) => void;
}

const iconOptions = [
  { value: 'MessageSquare', label: 'Message', icon: MessageSquare },
  { value: 'Building', label: 'Building', icon: Building },
  { value: 'Sparkles', label: 'Sparkles', icon: Sparkles },
  { value: 'HelpCircle', label: 'Help', icon: HelpCircle },
  { value: 'Lightbulb', label: 'Lightbulb', icon: Lightbulb },
  { value: 'Search', label: 'Search', icon: Search },
];

const QuestionSuggestionsConfig: React.FC<QuestionSuggestionsConfigProps> = ({ 
  suggestions, 
  onUpdate 
}) => {
  const [newSuggestion, setNewSuggestion] = useState({ text: '', icon: 'MessageSquare' });

  const addSuggestion = () => {
    if (newSuggestion.text.trim()) {
      const suggestion: QuestionSuggestion = {
        id: `suggestion-${Date.now()}`,
        text: newSuggestion.text.trim(),
        icon: newSuggestion.icon,
      };
      onUpdate([...suggestions, suggestion]);
      setNewSuggestion({ text: '', icon: 'MessageSquare' });
    }
  };

  const removeSuggestion = (id: string) => {
    onUpdate(suggestions.filter(s => s.id !== id));
  };

  const updateSuggestion = (id: string, field: keyof QuestionSuggestion, value: string) => {
    onUpdate(suggestions.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find(opt => opt.value === iconName);
    return iconOption ? iconOption.icon : MessageSquare;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Question Suggestions</Label>
        <p className="text-sm text-muted-foreground">
          Configure default question suggestions that appear in the user chat interface.
        </p>
      </div>

      {/* Add new suggestion */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Add New Suggestion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Input
              value={newSuggestion.text}
              onChange={(e) => setNewSuggestion(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Enter suggestion text..."
            />
            <div className="flex gap-2">
              <div className="flex gap-1">
                {iconOptions.map(option => {
                  const IconComponent = option.icon;
                  return (
                    <Button
                      key={option.value}
                      variant={newSuggestion.icon === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewSuggestion(prev => ({ ...prev, icon: option.value }))}
                      className="h-8 w-8 p-0"
                    >
                      <IconComponent className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
            </div>
            <Button onClick={addSuggestion} size="sm" disabled={!newSuggestion.text.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add Suggestion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((suggestion) => {
              const IconComponent = getIconComponent(suggestion.icon);
              return (
                <div key={suggestion.id} className="flex items-center gap-2 p-2 border rounded-md">
                  <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={suggestion.text}
                    onChange={(e) => updateSuggestion(suggestion.id, 'text', e.target.value)}
                    className="flex-1 border-0 shadow-none p-0 h-auto"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSuggestion(suggestion.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default QuestionSuggestionsConfig;