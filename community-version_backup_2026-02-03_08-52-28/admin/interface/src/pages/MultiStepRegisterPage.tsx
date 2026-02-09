import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { RegistrationProvider } from '@/contexts/RegistrationContext';
import RegistrationFlow from '@/components/registration/RegistrationFlow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Server, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const MultiStepRegisterPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFeatureEnabled, features } = useFeatureFlags();
  // Custom instance = proprietary edition with billing disabled (not community edition)
  const isCustomInstance = false;

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Disable registration for custom instances
  if (isCustomInstance) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border shadow-lg">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Server className="w-8 h-8 text-purple-600" />
            </div>
            <CardTitle className="text-2xl font-semibold">Registration Disabled</CardTitle>
            <CardDescription>
              Custom Instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Admin account creation is disabled on custom instances. 
                Please contact your administrator or support team for account access.
              </AlertDescription>
            </Alert>
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                If you need assistance, please contact support.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" asChild>
                  <Link to="/login">Go to Login</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RegistrationProvider>
      <RegistrationFlow />
    </RegistrationProvider>
  );
};

export default MultiStepRegisterPage;