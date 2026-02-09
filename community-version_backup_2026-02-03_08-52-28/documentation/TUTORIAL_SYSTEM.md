# Interactive Tutorial System Documentation

This document provides comprehensive documentation for the CitadelAI interactive tutorial system, including technical implementation, user experience design, and maintenance guidelines.

## Overview

The CitadelAI tutorial system is an immersive, step-by-step guided tour that helps new users learn the chatbot builder interface. It features sliding bubbles, visual highlights, and smooth animations to create an engaging onboarding experience.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Tutorial Steps](#tutorial-steps)
3. [Technical Implementation](#technical-implementation)
4. [User Experience Design](#user-experience-design)
5. [Integration Points](#integration-points)
6. [Customization Guide](#customization-guide)
7. [Troubleshooting](#troubleshooting)
8. [Future Enhancements](#future-enhancements)

## System Architecture

### Component Structure

```
admin/interface/src/
├── contexts/
│   └── TutorialContext.tsx          # Tutorial state management
├── components/tutorial/
│   ├── TutorialBubble.tsx           # Main tutorial bubble component
│   └── TutorialTrigger.tsx          # Tutorial start/restart button
├── styles/
│   └── tutorial.css                 # Tutorial-specific styles and animations
└── components/editor/
    └── BlockEditor.tsx              # Integration with main interface
```

### State Management

The tutorial system uses React Context for state management:

```typescript
interface TutorialContextType {
  isActive: boolean;           // Whether tutorial is currently running
  currentStep: number;         // Current step index (0-based)
  isCompleted: boolean;        // Whether user has completed tutorial
  startTutorial: () => void;   // Start the tutorial
  nextStep: () => void;        // Advance to next step
  previousStep: () => void;    // Go back to previous step
  skipTutorial: () => void;    // Skip the entire tutorial
  completeTutorial: () => void; // Mark tutorial as completed
  resetTutorial: () => void;   // Reset tutorial state
}
```

### Data Persistence

- **Local Storage**: Tutorial completion status is saved to `localStorage`
- **Session Persistence**: Tutorial state persists across browser sessions
- **Auto-Reset**: Tutorial can be reset to start from the beginning

## Tutorial Steps

### Step 1: Welcome
- **Target**: `.tutorial-welcome` (centered on screen)
- **Purpose**: Introduction to the chatbot builder
- **Content**: Overview of what users will learn
- **Position**: Center of screen

### Step 2: Block Library
- **Target**: `.block-palette` (left sidebar)
- **Purpose**: Introduction to the block library
- **Content**: Explanation of available blocks and drag-and-drop functionality
- **Position**: Right side of the block library

### Step 3: Canvas Area
- **Target**: `.canvas-area` (main workspace)
- **Purpose**: Introduction to the main workspace
- **Content**: Overview of the canvas and how to build workflows
- **Position**: Top-left corner of canvas

### Step 4: System Prompt Block
- **Target**: System Prompt block (`.rounded-full` class)
- **Purpose**: Explanation of AI configuration
- **Content**: How to configure the AI's behavior and knowledge
- **Position**: Above the block

### Step 5: Add Frontend Interface
- **Target**: Frontend block (`.rounded-lg` class)
- **Purpose**: Introduction to user interface blocks
- **Content**: How to add and configure frontend components
- **Position**: Left side of the block

### Step 6: Add Action Block
- **Target**: Action block in palette
- **Purpose**: Introduction to action-based blocks
- **Content**: How to add actions and configure workflows
- **Position**: Left side of the block

### Step 7: Test Mode
- **Target**: `.test-mode-button` (test button)
- **Purpose**: How to test the chatbot
- **Content**: Explanation of testing functionality
- **Position**: Bottom of the button

### Step 8: Settings
- **Target**: `.settings-button` (settings button)
- **Purpose**: Access to configuration
- **Content**: How to access settings and deployment options
- **Position**: Bottom of the button

### Step 9: Block Properties
- **Target**: Block properties panel
- **Purpose**: How to configure individual blocks
- **Content**: Overview of block configuration options
- **Position**: Right side of properties panel

### Step 10: Completion
- **Target**: None (centered on screen)
- **Purpose**: Tutorial completion and next steps
- **Content**: Summary and encouragement to start building
- **Position**: Center of screen

## Technical Implementation

### TutorialBubble Component

The main tutorial component handles:
- **Element Targeting**: Finding and highlighting specific UI elements
- **Position Calculation**: Dynamic positioning of tutorial bubbles
- **Overlay Management**: Creating cutout effects for highlighted elements
- **Animation Handling**: Smooth transitions between steps
- **Keyboard Navigation**: Arrow key and space bar support

#### Key Features

```typescript
// Element targeting with special handling
if (currentStepData.id === 'system-prompt') {
  // Find system prompt block by rounded-full class
  const blocks = document.querySelectorAll('[data-block-id]');
  for (const block of blocks) {
    const innerDiv = block.querySelector('.rounded-full');
    if (innerDiv) {
      targetElement = block as HTMLElement;
      break;
    }
  }
}

// Dynamic positioning based on element location
const rect = targetElement.getBoundingClientRect();
const bubbleRect = bubbleRef.current?.getBoundingClientRect() || { width: 384, height: 200 };
const padding = 20;

switch (currentStepData.position) {
  case 'right':
    x = rect.right + padding;
    y = rect.top + rect.height / 2 - bubbleRect.height / 2;
    break;
  case 'left':
    x = rect.left - bubbleRect.width - padding;
    y = rect.top + rect.height / 2 - bubbleRect.height / 2;
    break;
  // ... other positions
}
```

### Overlay System

The tutorial uses a sophisticated overlay system to highlight elements:

#### Base Overlay
- **Full Screen Coverage**: Semi-transparent dark background
- **Z-Index**: 9998 (below highlighted elements, above interface)

#### Cutout Effect
- **Box Shadow Technique**: Uses `box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5)`
- **Transparent Center**: Creates a "window" effect
- **Rounded Corners**: 12px border radius for polished look
- **Smooth Transitions**: Animated cutout movements

#### Highlighted Elements
- **Z-Index**: 10001 (above all overlays)
- **Visual Effects**: Pulsing animation and outline
- **CSS Classes**: `.tutorial-highlight` with custom styling

### Animation System

#### CSS Animations

```css
@keyframes tutorial-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes tutorial-bubble-enter {
  from { 
    opacity: 0; 
    transform: scale(0.8) translateY(20px); 
  }
  to { 
    opacity: 1; 
    transform: scale(1) translateY(0); 
  }
}

@keyframes tutorial-bubble-exit {
  from { 
    opacity: 1; 
    transform: scale(1) translateY(0); 
  }
  to { 
    opacity: 0; 
    transform: scale(0.8) translateY(-20px); 
  }
}
```

#### Transition Effects
- **Bubble Movement**: Smooth sliding between positions
- **Overlay Changes**: Fade transitions for cutout adjustments
- **Element Highlights**: Scale and fade animations
- **Duration**: 0.3-0.4s for optimal user experience

## User Experience Design

### Visual Design Principles

#### Consistency
- **Color Scheme**: Matches CitadelAI brand colors
- **Typography**: Consistent with interface font families
- **Spacing**: Uniform padding and margins throughout
- **Shadows**: Consistent shadow depth and blur

#### Accessibility
- **High Contrast**: Clear distinction between highlighted and dimmed areas
- **Keyboard Navigation**: Full keyboard support with arrow keys
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Focus Management**: Logical tab order and focus indicators

#### Responsiveness
- **Viewport Awareness**: Bubbles stay within screen bounds
- **Mobile Optimization**: Touch-friendly controls and sizing
- **Adaptive Positioning**: Adjusts to different screen sizes
- **Element Detection**: Robust targeting across different layouts

### Interaction Patterns

#### Navigation
- **Forward**: Next button, right arrow key, space bar
- **Backward**: Previous button, left arrow key
- **Skip**: Skip button, escape key
- **Restart**: Settings → Tutorial tab

#### Visual Feedback
- **Progress Bar**: Shows current step (e.g., "Step 3 of 10")
- **Button States**: Hover, active, and disabled states
- **Loading States**: Smooth transitions during step changes
- **Error Handling**: Clear error messages and recovery options

## Integration Points

### Settings Modal Integration

The tutorial is integrated into the settings modal:

```typescript
// Settings modal with tutorial tab
<Tabs defaultValue="deployment" className="space-y-6">
  <TabsList className="grid w-full grid-cols-4">
    <TabsTrigger value="deployment">Deployment</TabsTrigger>
    <TabsTrigger value="users">Users</TabsTrigger>
    <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
    <TabsTrigger value="danger">Danger Zone</TabsTrigger>
  </TabsList>
  
  <TabsContent value="tutorial">
    <div className="p-6 rounded-lg border bg-card">
      <h3 className="font-medium mb-2">Interactive Tutorial</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Learn how to use the chatbot builder with our step-by-step tutorial.
      </p>
      <TutorialTrigger onTutorialStart={() => onOpenChange(false)} />
    </div>
  </TabsContent>
</Tabs>
```

### Auto-Launch Logic

Tutorial automatically launches for new users:

```typescript
// Auto-start tutorial for new users
useEffect(() => {
  if (!isCompleted) {
    const timer = setTimeout(() => {
      startTutorial();
    }, 1000); // Small delay to ensure everything is loaded
    return () => clearTimeout(timer);
  }
}, [isCompleted, startTutorial]);
```

### BlockEditor Integration

Tutorial is integrated into the main BlockEditor component:

```typescript
// BlockEditor.tsx
import TutorialBubble from '../tutorial/TutorialBubble';
import { useTutorial } from '@/contexts/TutorialContext';

// In render:
<TutorialBubble step={0} />
```

## Customization Guide

### Adding New Tutorial Steps

1. **Update TutorialContext**: Add new step to `tutorialSteps` array
2. **Define Target Element**: Specify CSS selector for highlighting
3. **Set Position**: Choose bubble position (top, bottom, left, right, center, etc.)
4. **Add Content**: Write title, description, and action text
5. **Test Integration**: Ensure element targeting works correctly

```typescript
// Example new step
{
  id: 'new-feature',
  title: 'New Feature',
  description: 'This is how to use the new feature.',
  targetElement: '.new-feature-button',
  position: 'right',
  action: 'none',
  skipable: true
}
```

### Modifying Existing Steps

1. **Update Content**: Change title, description, or action text
2. **Adjust Targeting**: Modify CSS selector if UI changes
3. **Reposition Bubble**: Change position for better UX
4. **Test Changes**: Verify targeting and positioning work

### Styling Customization

#### CSS Variables
```css
:root {
  --tutorial-bubble-bg: #ffffff;
  --tutorial-bubble-border: #e5e7eb;
  --tutorial-highlight-color: #3b82f6;
  --tutorial-overlay-opacity: 0.5;
}
```

#### Animation Timing
```css
.tutorial-bubble {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.tutorial-highlight {
  animation: tutorial-pulse 2s infinite;
}
```

## Troubleshooting

### Common Issues

#### Tutorial Not Starting
- **Check Local Storage**: Verify `citadel_tutorial_completed` is not set to `true`
- **Element Targeting**: Ensure target elements exist in DOM
- **Context Provider**: Verify TutorialProvider wraps the app
- **Console Errors**: Check for JavaScript errors in browser console

#### Highlighting Not Working
- **Z-Index Issues**: Ensure highlighted elements have `z-index: 10001`
- **Overlay Problems**: Check cutout overlay positioning
- **Element Visibility**: Verify target elements are visible and not hidden
- **CSS Conflicts**: Check for conflicting CSS rules

#### Positioning Problems
- **Viewport Bounds**: Ensure bubbles stay within screen bounds
- **Element Detection**: Verify CSS selectors match actual elements
- **Responsive Issues**: Test on different screen sizes
- **Transform Conflicts**: Check for CSS transform conflicts

### Debug Mode

Enable debug logging by adding console.log statements:

```typescript
// In TutorialBubble.tsx
console.log(`Step ${currentStep + 1}: ${currentStepData.title}`);
console.log('Target element found:', targetElement);
console.log('Highlight rect:', highlightRect);
```

### Performance Issues

#### Optimization Tips
- **Debounce Resize**: Debounce window resize events
- **Lazy Loading**: Load tutorial assets only when needed
- **Memory Cleanup**: Properly clean up event listeners
- **Animation Performance**: Use CSS transforms instead of changing layout properties

## Future Enhancements

### Planned Features

#### Enhanced Interactivity
1. **Interactive Demos**: Hands-on practice with guided actions
2. **Video Integration**: Optional video explanations for complex features
3. **Customizable Paths**: Different tutorial flows for different user types
4. **Progress Analytics**: Track completion rates and drop-off points
5. **Multi-language Support**: Tutorial content in multiple languages

#### Technical Improvements
1. **Performance Optimization**: Lazy loading and code splitting
2. **Mobile Optimization**: Touch-friendly controls and gestures
3. **Offline Support**: Tutorial works without internet connection
4. **A/B Testing**: Test different tutorial approaches
5. **Analytics Integration**: Detailed usage analytics and insights

#### Advanced Features
1. **Contextual Help**: Context-sensitive help system
2. **Smart Suggestions**: AI-powered tutorial recommendations
3. **User Preferences**: Customizable tutorial settings
4. **Integration Testing**: Automated tutorial flow testing
5. **Accessibility Enhancements**: Advanced accessibility features

### Implementation Roadmap

#### Phase 1: Core Improvements
- Performance optimization
- Mobile responsiveness
- Enhanced accessibility

#### Phase 2: Advanced Features
- Interactive demos
- Video integration
- Analytics dashboard

#### Phase 3: AI Integration
- Smart suggestions
- Contextual help
- Personalized paths

## API Reference

### TutorialContext Methods

```typescript
interface TutorialContextType {
  // State
  isActive: boolean;
  currentStep: number;
  isCompleted: boolean;
  
  // Actions
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
}
```

### TutorialStep Interface

```typescript
interface TutorialStep {
  id: string;                    // Unique identifier
  title: string;                 // Step title
  description: string;           // Step description
  targetElement: string | null;  // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'top-left' | 'above';
  action: 'none' | 'click' | 'drag';  // Required user action
  actionText?: string;           // Action button text
  skipable: boolean;             // Can be skipped
}
```

### Component Props

#### TutorialBubble
```typescript
interface TutorialBubbleProps {
  step?: number;  // Optional step override
}
```

#### TutorialTrigger
```typescript
interface TutorialTriggerProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  onTutorialStart?: () => void;  // Callback when tutorial starts
}
```

## Conclusion

The CitadelAI tutorial system provides a comprehensive, user-friendly onboarding experience that helps new users quickly understand and master the chatbot builder interface. With its sophisticated visual design, smooth animations, and robust technical implementation, it sets a high standard for interactive tutorials in web applications.

The system is designed to be maintainable, customizable, and extensible, allowing for future enhancements and improvements as the platform evolves. Regular testing, user feedback collection, and performance monitoring ensure the tutorial continues to provide value to users while maintaining high quality standards.