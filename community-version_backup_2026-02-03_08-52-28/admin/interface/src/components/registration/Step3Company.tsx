import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, ArrowLeft } from 'lucide-react';
import { useRegistration } from '@/contexts/RegistrationContext';

const Step3Company: React.FC = () => {
  const { registrationData, updateRegistrationData, goToNextStep, goToPreviousStep, canProceed, canGoBack } = useRegistration();

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateRegistrationData({ company: e.target.value });
  };

  const handleNext = () => {
    goToNextStep();
  };

  const handleBack = () => {
    goToPreviousStep();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  return (
    <div className="w-full mx-auto" style={{ width: '512px', maxWidth: '512px' }}>
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-scale-in animation-delay-200">
          <Building className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up animation-delay-300">
          Company Information
        </h1>
        <p className="text-muted-foreground animate-slide-up animation-delay-400">
          Tell us about your company
        </p>
      </div>
      
      <Card className="border shadow-lg animate-slide-up animation-delay-500 w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Company Details</CardTitle>
          <CardDescription>
            This helps us personalize your experience
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                type="text"
                value={registrationData.company}
                onChange={handleCompanyChange}
                onKeyDown={handleKeyPress}
                placeholder="Enter your company name"
                className="transition-all duration-200 focus:scale-[1.02]"
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be used to identify your organization and can be changed later.
              </p>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            {canGoBack(3) && (
              <Button
                onClick={handleBack}
                variant="outline"
                className="flex-1 h-11 transition-all duration-200 hover:scale-[1.02]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed(3)}
              className={`${canGoBack(3) ? 'flex-1' : 'w-full'} h-11 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step3Company;