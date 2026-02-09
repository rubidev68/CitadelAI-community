import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, BarChart3, Settings, LogOut, Sparkles, TrendingUp, MessageSquare, LogIn, User, CreditCard, Calendar } from 'lucide-react';
import { createChatbot as apiCreateChatbot, getChatbots, loginAsTestUser, getDashboardStats, DashboardStats, StatsPeriod } from '@/lib/api';
import { USER_INTERFACE_URL } from '@/lib/apiClient';
import { useErrorHandler, ApiError } from '@/hooks/useErrorHandler';
import UserSettingsModal from '@/components/UserSettingsModal';
import SubscriptionButton from '@/components/SubscriptionButton';
import { useSubscription } from '@/contexts/SubscriptionContext';
import TrialExpiredModal from '@/components/TrialExpiredModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ChatbotWithCount {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  conversationCount?: number;
}

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const { subscriptionStatus } = useSubscription();
  const navigate = useNavigate();
  const { handleError } = useErrorHandler(logout);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState("profile");
  const [chatbotName, setChatbotName] = useState('');
  const [chatbots, setChatbots] = useState<ChatbotWithCount[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('global');

  useEffect(() => {
    const fetchChatbots = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const fetchedChatbots = await getChatbots(token);
          setChatbots(fetchedChatbots);
        } catch (error) {
          console.error("Failed to fetch chatbots:", error);
          handleError(error as ApiError);
        }
      }
    };

    fetchChatbots();
  }, [handleError]);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const stats = await getDashboardStats(token, statsPeriod);
          setDashboardStats(stats);
        } catch (error) {
          console.error("Failed to fetch dashboard stats:", error);
          // Don't show error to user for stats, just log it
        }
      }
    };

    fetchStats();
  }, [statsPeriod]);

  const handleCreateChatbot = async () => {
    if (chatbotName.trim()) {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          return;
        }
        const newChatbot = await apiCreateChatbot(chatbotName.trim(), token);
        navigate(`/chatbot/${newChatbot.id}`);
        setIsCreateDialogOpen(false);
        setChatbotName('');
      } catch (error) {
        console.error("Failed to create chatbot:", error);
        handleError(error as ApiError);
      }
    }
  };

  // Check if chatbot limit is reached
  const isChatbotLimitReached = subscriptionStatus?.maxChatbots !== null && 
    subscriptionStatus?.currentChatbotCount !== undefined &&
    subscriptionStatus.currentChatbotCount >= subscriptionStatus.maxChatbots;

  const handleEditChatbot = (id: string) => {
    navigate(`/chatbot/${id}`);
  };

  const handleLoginAsTestUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const { token: userToken } = await loginAsTestUser(token);
        window.open(`${USER_INTERFACE_URL}/?test_token=${userToken}`, '_blank');
      } catch (error) {
        console.error("Failed to login as test user:", error);
        handleError(error as ApiError);
      }
    }
  };

  const getChatbotColor = (index: number) => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-cyan-500 to-sky-600',
    ];
    return colors[index % colors.length];
  };

  const showTrialExpiredModal = Boolean(
    isFeatureEnabled('billing') &&
    subscriptionStatus?.hasSubscription &&
    subscriptionStatus.status === 'TRIAL' &&
    !subscriptionStatus.isActive
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <TrialExpiredModal open={showTrialExpiredModal} />
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img 
                  src="/logo-icon.png" 
                  alt="CitadelAI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Chatbot Dashboard
                </h1>
                {user?.company && (
                  <p className="text-sm text-muted-foreground">{user.company}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Welcome,</span>
                <span className="text-sm font-medium">{user?.name || user?.email}</span>
                {user?.provider && user.provider !== 'email' && (
                  <Badge variant="secondary" className="text-xs">
                    {user.provider}
                  </Badge>
                )}
                {isFeatureEnabled('billing') ? (
                  <Badge 
                    variant="outline" 
                    className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => {
                      setSettingsDefaultTab("community");
                      setIsUserSettingsOpen(true);
                    }}
                  >
                    Business Edition
                  </Badge>
                ) : (
                  <Badge 
                    variant="outline" 
                    className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
                    onClick={() => {
                      setSettingsDefaultTab("community");
                      setIsUserSettingsOpen(true);
                    }}
                  >
                    Community Edition
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsUserSettingsOpen(true)}>
                <User className="w-4 h-4 mr-2" />
                Settings
              </Button>
              {isFeatureEnabled('billing') && (
                <SubscriptionButton onManageSubscription={() => {
                  setSettingsDefaultTab("subscription");
                  setIsUserSettingsOpen(true);
                }} />
              )}
              <Button variant="outline" size="sm" onClick={handleLoginAsTestUser}>
                <LogIn className="w-4 h-4 mr-2" />
                Test Mode
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Header with Period Selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground flex items-center">
              <BarChart3 className="w-6 h-6 text-primary mr-2" />
              Statistics
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Overview of your chatbot performance</p>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={statsPeriod} onValueChange={(value) => setStatsPeriod(value as StatsPeriod)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
                <SelectItem value="global">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-lg transition-all duration-300 hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Total Chatbots</CardTitle>
              <div className="p-2 bg-primary/20 rounded-lg">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{chatbots.length}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                Total chatbots
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20 hover:shadow-lg transition-all duration-300 hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-secondary">Total Conversations</CardTitle>
              <div className="p-2 bg-secondary/20 rounded-lg">
                <MessageSquare className="h-4 w-4 text-secondary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {dashboardStats?.totalConversations.toLocaleString() ?? '...'}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                Across all chatbots
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20 hover:shadow-lg transition-all duration-300 hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-accent">Total Messages</CardTitle>
              <div className="p-2 bg-accent/20 rounded-lg">
                <MessageSquare className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {dashboardStats?.totalMessages.toLocaleString() ?? '...'}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                Across all conversations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chatbots Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground flex items-center">
              <Sparkles className="w-6 h-6 text-primary mr-2" />
              Your Chatbots
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Manage and monitor your AI assistants</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="flex items-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                disabled={isChatbotLimitReached}
                title={isChatbotLimitReached ? `You have reached your chatbot limit (${subscriptionStatus?.currentChatbotCount}/${subscriptionStatus?.maxChatbots}). Please upgrade to create more chatbots.` : undefined}
              >
                <Plus className="w-4 h-4" />
                <span>Create New Chatbot</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold flex items-center">
                  <Bot className="w-5 h-5 text-primary mr-2" />
                  Create New Chatbot
                </DialogTitle>
                <DialogDescription>
                  {isChatbotLimitReached 
                    ? `You have reached your chatbot limit (${subscriptionStatus?.currentChatbotCount}/${subscriptionStatus?.maxChatbots}) for your ${subscriptionStatus?.plan?.name} plan. Please upgrade to create more chatbots.`
                    : 'Give your chatbot a name to get started. You can change this later.'}
                </DialogDescription>
              </DialogHeader>
              {isChatbotLimitReached ? (
                <div className="py-4">
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You have reached your chatbot limit ({subscriptionStatus?.currentChatbotCount}/{subscriptionStatus?.maxChatbots}) for your {subscriptionStatus?.plan?.name} plan. Please upgrade to create more chatbots.
                    </AlertDescription>
                  </Alert>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="chatbot-name">Chatbot Name</Label>
                      <Input
                        id="chatbot-name"
                        placeholder="e.g., Customer Support Bot"
                        value={chatbotName}
                        onChange={(e) => setChatbotName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateChatbot()}
                        className="focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateChatbot}
                      disabled={!chatbotName.trim()}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Create Chatbot
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {chatbots.map((chatbot, index) => (
            <Card key={chatbot.id} className="hover:shadow-lg transition-all duration-300 cursor-pointer hover-scale bg-card/50 backdrop-blur-sm border-l-4 border-l-transparent hover:border-l-primary animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${getChatbotColor(index)} rounded-xl flex items-center justify-center shadow-lg`}>
                      <Bot className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{chatbot.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {chatbot.conversationCount ?? 0} {chatbot.conversationCount === 1 ? 'conversation' : 'conversations'}
                        </span>
                        <span>Last active: just now</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={chatbot.status === 'ACTIVE' ? 'default' : 'secondary'}
                      className={`capitalize ${
                        chatbot.status === 'ACTIVE' 
                          ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30' 
                          : 'bg-gray-500/20 text-gray-700 border-gray-500/30'
                      }`}
                    >
                      {chatbot.status.toLowerCase()}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditChatbot(chatbot.id)}
                      className="border-primary/20 hover:border-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {chatbots.length === 0 && (
          <Card className="text-center py-16 bg-gradient-to-br from-primary/5 to-primary/3 border-dashed border-2 border-primary/30">
            <CardContent>
              <div className="w-24 h-24 bg-primary rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
                <Bot className="w-12 h-12 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No chatbots yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Create your first chatbot to get started with automated conversations and unlock the power of AI assistance.
              </p>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={isChatbotLimitReached}
                    title={isChatbotLimitReached ? `You have reached your chatbot limit (${subscriptionStatus?.currentChatbotCount}/${subscriptionStatus?.maxChatbots}). Please upgrade to create more chatbots.` : undefined}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Chatbot
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        )}
      </div>
      
      <UserSettingsModal 
        open={isUserSettingsOpen} 
        onOpenChange={(open) => {
          setIsUserSettingsOpen(open);
          if (!open) setSettingsDefaultTab("profile"); // Reset to profile when closing
        }}
        defaultTab={settingsDefaultTab}
      />
    </div>
  );
};

export default Dashboard;