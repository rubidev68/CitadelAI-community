import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Mail } from "lucide-react";

const Unauthorized = () => {
  return (
    <div className="min-h-screen chapel-gradient flex items-center justify-center p-8">
      <Card className="w-full max-w-md stone-shadow">
        <CardHeader className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-50 mx-auto flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <CardTitle className="citadel-heading text-xl">Access Restricted</CardTitle>
          <CardDescription className="nave-text">
            You don't have permission to access this platform. Please contact your administrator for an invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="space-y-2">
            <p className="nave-text text-sm">
              If you believe this is an error, please reach out to your system administrator with your email address.
            </p>
            <p className="nave-text text-xs text-muted-foreground">
              Only invited users can access this platform.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full sacred-transition"
              onClick={() => window.location.href = 'mailto:admin@platform.dev?subject=Platform Access Request'}
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact Administrator
            </Button>
            
            <Button
              variant="ghost"
              className="w-full sacred-transition"
              onClick={() => window.location.href = '/'}
            >
              Return to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unauthorized;