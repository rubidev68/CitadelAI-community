import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Mail, User, Building } from "lucide-react";

import { registerUser } from "../lib/auth";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);


  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const data = await registerUser({ name, email, password });
      
      toast({
        title: "Welcome to the platform!",
        description: "Your account has been created successfully",
      });
      
      login(data.token);
      navigate("/");
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthRegister = (provider: string) => {
    toast({
      title: "OAuth Registration",
      description: `${provider} authentication requires Supabase integration`,
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen chapel-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full nave-gradient mx-auto flex items-center justify-center divine-shadow">
            <Building className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="citadel-heading text-3xl">Create Account</h1>
            <p className="nave-text text-muted-foreground">Join our platform to get started</p>
          </div>
        </div>

        {/* OAuth Providers */}
        <Card className="stone-shadow">
          <CardContent className="pt-6 space-y-3">
            <Button
              variant="outline"
              className="w-full sacred-transition"
              disabled
              aria-disabled
              title="Social registration is disabled"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
            
            <Button
              variant="outline"
              className="w-full sacred-transition"
              disabled
              aria-disabled
              title="Social registration is disabled"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path fill="#F25022" d="M0 0h11v11H0z"/>
                <path fill="#00A4EF" d="M13 0h11v11H13z"/>
                <path fill="#7FBA00" d="M0 13h11v11H0z"/>
                <path fill="#FFB900" d="M13 13h11v11H13z"/>
              </svg>
              Continue with Microsoft
            </Button>

            <Button
              variant="outline"
              className="w-full sacred-transition"
              disabled
              aria-disabled
              title="SSO is disabled"
            >
              <Lock className="h-4 w-4 mr-2" />
              Single Sign-On (SSO)
            </Button>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="relative">
          <Separator />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-background px-2 text-muted-foreground text-sm">or</span>
          </div>
        </div>

        {/* Email Registration Form */}
        <Card className="stone-shadow">
          <CardHeader>
            <CardTitle className="citadel-heading text-center">Create account with email</CardTitle>
            <CardDescription className="nave-text text-center">
              Fill in your details to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="sacred-transition"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sacred-transition"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sacred-transition"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="sacred-transition"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email || !password || !name || !confirmPassword}
                className="w-full nave-gradient sacred-transition"
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="nave-text text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
          <p className="nave-text text-xs text-muted-foreground">
            By creating an account, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;