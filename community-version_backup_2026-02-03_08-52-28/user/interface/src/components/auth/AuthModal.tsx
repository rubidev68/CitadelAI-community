import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, User, Shield } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (type: 'login' | 'register', email: string, password: string, name?: string) => {
    setIsLoading(true);
    
    try {
      // Mock API call - replace with actual citadel backend
      const response = await fetch(`/api/auth/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed`);
      }

      const { token } = await response.json();
      
      toast({
        title: "Welcome!",
        description: `Successfully ${type === 'login' ? 'signed in' : 'created your account'}`,
      });
      
      onSuccess(token);
      onClose();
    } catch (error) {
      // Mock success for now
      const mockToken = `mock-jwt-token-${Date.now()}`;
      localStorage.setItem('citadel-token', mockToken);
      
      toast({
        title: "Welcome!",
        description: `Successfully ${type === 'login' ? 'signed in' : 'created your account'}`,
      });
      
      onSuccess(mockToken);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const LoginForm = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    return (
      <Card className="border-0 shadow-none">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="citadel-heading flex items-center justify-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Sign In
          </CardTitle>
          <CardDescription className="nave-text">
            Access your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sacred-transition"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password
            </Label>
            <Input
              id="login-password"
              type="password"
              placeholder="Enter your passphrase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sacred-transition"
            />
          </div>
          <Button
            onClick={() => handleAuth('login', email, password)}
            disabled={isLoading || !email || !password}
            className="w-full nave-gradient sacred-transition"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const RegisterForm = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    return (
      <Card className="border-0 shadow-none">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="citadel-heading flex items-center justify-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Create Account
          </CardTitle>
          <CardDescription className="nave-text">
            Join our platform to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="register-name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Name
            </Label>
            <Input
              id="register-name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sacred-transition"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="register-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sacred-transition"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password
            </Label>
            <Input
              id="register-password"
              type="password"
              placeholder="Create a secure passphrase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sacred-transition"
            />
          </div>
          <Button
            onClick={() => handleAuth('register', email, password, name)}
            disabled={isLoading || !email || !password || !name}
            className="w-full nave-gradient sacred-transition"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md stone-shadow">
        <DialogHeader>
          <DialogTitle className="citadel-heading text-center">
            Account Access
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="mt-6">
            <LoginForm />
          </TabsContent>
          
          <TabsContent value="register" className="mt-6">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}