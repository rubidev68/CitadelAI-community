import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, ArrowLeft, Sparkles, CheckCircle } from 'lucide-react';
import { useRegistration } from '@/contexts/RegistrationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { createChatbot, loginUser, updateUserProfile } from '@/lib/api';

const Step5Chatbot: React.FC = () => {
  const { registrationData, updateRegistrationData, goToPreviousStep, canProceed, resetRegistration, canGoBack } = useRegistration();
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChatbotNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateRegistrationData({ chatbotName: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateRegistrationData({ chatbotDescription: e.target.value });
  };

  const handleBack = () => {
    goToPreviousStep();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canProceed(5)) {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!canProceed(5)) return;

    setIsCreating(true);
    try {
      // Account is already created in Step 1, so we just need to log in
      const { token, user } = await loginUser(
        registrationData.email,
        registrationData.password
      );

      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      // Update user profile with company and name collected in steps 3-4
      const updatedUser = await updateUserProfile(
        {
          name: registrationData.name,
          email: registrationData.email,
          company: registrationData.company,
        },
        token
      );

      // Update auth context and localStorage
      updateUser(updatedUser);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));

      // Create the chatbot with the provided name and description
      // The backend will automatically set these in the interface block
      const newChatbot = await createChatbot(
        registrationData.chatbotName, 
        token, 
        registrationData.chatbotDescription
      );

      setIsSuccess(true);
      // Show success state for a moment before navigating to the chatbot builder
      setTimeout(() => {
        resetRegistration();
        navigate(`/chatbot/${newChatbot.id}`);
      }, 2000);
    } catch (error) {
      console.error('Login, profile update, or chatbot creation failed:', error);
      alert('Failed to complete setup. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full mx-auto" style={{ width: '512px', maxWidth: '512px' }}>
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200 animate-pulse-gentle">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
            Welcome to CitadelAI - Built to help not to replace!
          </h1>
          <p className="text-muted-foreground animate-slide-up animation-delay-400">
            Your account and chatbot have been created successfully. Redirecting to chatbot builder...
          </p>
        </div>
        
        <Card className="border shadow-lg animate-slide-up animation-delay-500 w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold">Registration Complete!</CardTitle>
            <CardDescription>
              You're all set up and ready to go
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto" style={{ width: '512px', maxWidth: '512px' }}>
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200">
          <Bot className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
          Create Your First Chatbot
        </h1>
        <p className="text-muted-foreground animate-slide-up animation-delay-400">
          Let's set up your first AI assistant
        </p>
      </div>
      
      <Card className="border shadow-lg animate-slide-up animation-delay-500 w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Chatbot Setup</CardTitle>
          <CardDescription>
            Give your chatbot a name and description
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chatbotName">Chatbot Name</Label>
              <Input
                id="chatbotName"
                type="text"
                value={registrationData.chatbotName}
                onChange={handleChatbotNameChange}
                onKeyDown={handleKeyPress}
                placeholder="e.g., Customer Support Bot"
                className="transition-all duration-200 focus:scale-[1.02]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={registrationData.chatbotDescription || ''}
                onChange={handleDescriptionChange}
                placeholder="Describe what this chatbot will help with..."
                className="min-h-[80px] transition-all duration-200 resize-none"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Pro Tip:</p>
                  <p>You can always modify your chatbot's name, description, and behavior after creating it. This is just to get you started!</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            {canGoBack(5) && (
              <Button
                onClick={handleBack}
                variant="outline"
                className="flex-1 h-11 transition-all duration-200 hover:scale-[1.02]"
                disabled={isCreating}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button
              onClick={handleComplete}
              disabled={!canProceed(5) || isCreating}
              className={`${canGoBack(5) ? 'flex-1' : 'w-full'} h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Complete Setup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step5Chatbot;