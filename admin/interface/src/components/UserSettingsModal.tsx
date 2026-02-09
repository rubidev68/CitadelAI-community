import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Lock, Trash2, AlertTriangle, Mail, Building, Crown, CreditCard, Check, X, Info, Shield, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { updateUserProfile, changePassword, deleteAccount, getMe, disableTwoFactor, regenerateBackupCodes } from '@/lib/api';
import { useErrorHandler, ApiError } from '@/hooks/useErrorHandler';
import { useNavigate } from 'react-router-dom';

import CommunityEditionInfo from './CommunityEditionInfo';

import CustomInstanceInfo from './CustomInstanceInfo';
import { getTermsOfServiceUrl, getPrivacyPolicyUrl } from '@/utils/businessWebsiteUrl';

interface UserSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  onReopen?: () => void; // Callback to reopen this modal when coming back from subscription
}

const UserSettingsModal = ({ open, onOpenChange, defaultTab = "profile", onReopen }: UserSettingsModalProps) => {
  const { user, logout, updateUser, refreshUser } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const { toast } = useToast();
  const { handleError } = useErrorHandler(logout);
  const navigate = useNavigate();
  
  // Personal Info State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [company, setCompany] = useState(user?.company || '');
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Account Deletion State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  
  // 2FA State
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableOtp, setDisableOtp] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [regenerateOtp, setRegenerateOtp] = useState('');
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  
  // Modal history state
  const [modalHistory, setModalHistory] = useState<string[]>([]);
  
  // Tab animation state
  const [currentTab, setCurrentTab] = useState(defaultTab);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  
  // Loading States
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (open && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setCompany(user.company || '');
    }
    if (open) {
      setCurrentTab(defaultTab);
    }
  }, [open, user, defaultTab]);

  // Tab order for determining slide direction
  const getTabOrder = () => {
    const tabs = ['profile'];
    
    tabs.push('community', 'security', 'danger');
    return tabs;
  };

  const handleTabChange = (value: string) => {
    const tabOrder = getTabOrder();
    const currentIndex = tabOrder.indexOf(currentTab);
    const newIndex = tabOrder.indexOf(value);
    
    if (currentIndex !== -1 && newIndex !== -1) {
      setSlideDirection(newIndex > currentIndex ? 'right' : 'left');
    }
    
    setCurrentTab(value);
  };

  const handleUpdateProfile = async () => {
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      await updateUserProfile({ name: name.trim(), email: email.trim(), company: company.trim() }, token);
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      
      // Refresh user data and update context
      const updatedUser = await getMe(token);
      updateUser(updatedUser);
      
    } catch (error) {
      console.error("Failed to update profile:", error);
      handleError(error as ApiError);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "All password fields are required",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      await changePassword(currentPassword, newPassword, token);
      
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error) {
      console.error("Failed to change password:", error);
      handleError(error as ApiError);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmEmail !== user?.email) {
      toast({
        title: "Error",
        description: "Email confirmation does not match",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingAccount(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      await deleteAccount(token);
      
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted",
      });
      
      // Logout and redirect
      logout();
      
    } catch (error) {
      console.error("Failed to delete account:", error);
      handleError(error as ApiError);
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmEmail('');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg mr-3">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
              User Settings
            </DialogTitle>
            <DialogDescription>
              Manage your personal information, security settings, and account preferences
            </DialogDescription>
          </DialogHeader>

          <Tabs 
            defaultValue={defaultTab} 
            value={currentTab}
            onValueChange={handleTabChange}
            className="space-y-6"
          >
            <TabsList className={`grid w-full ${isFeatureEnabled('billing') ? 'grid-cols-4' : 'grid-cols-4'}`}>
              <TabsTrigger value="profile" className="flex items-center space-x-2">
                <User className="w-5 h-5 flex-shrink-0" />
                <span>Profile</span>
              </TabsTrigger>
              
              <TabsTrigger value="community" className="flex items-center space-x-2">
                <Info className="w-5 h-5 flex-shrink-0" />
                <span>About</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center space-x-2">
                <Lock className="w-5 h-5 flex-shrink-0" />
                <span>Security</span>
              </TabsTrigger>
              <TabsTrigger value="danger" className="flex items-center space-x-2 text-red-500">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>Danger Zone</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab content wrapper with sliding animation */}
            <div className="relative overflow-hidden min-h-[400px]">
              <div 
                className={`${
                  slideDirection === 'right' 
                    ? 'animate-slide-in-right' 
                    : 'animate-slide-in-left'
                }`}
                key={currentTab}
              >

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4">
              <div className="p-6 rounded-lg bg-gradient-to-br from-primary/5 to-primary/3 border border-primary/20">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <User className="w-5 h-5 text-primary mr-2" />
                  Personal Information
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="focus:border-primary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="focus:border-primary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company">Company (Optional)</Label>
                    <Input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Enter your company name"
                      className="focus:border-primary"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={isUpdatingProfile}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isUpdatingProfile ? "Updating..." : "Update Profile"}
                  </Button>
                </div>
              </div>
                </TabsContent>

                {/* Community Tab */}
                <TabsContent value="community" className="space-y-4">
              <CustomInstanceInfo />
              
              {/* Legal Links */}
              <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Legal</h3>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={getTermsOfServiceUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Terms of Service
                  </a>
                  <a
                    href={getPrivacyPolicyUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Privacy Policy
                  </a>
                </div>
              </div>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-4">
              {/* Two-Factor Authentication Section */}
              <div className="p-6 rounded-lg bg-gradient-to-br from-primary/5 to-primary/3 border border-primary/20">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Shield className="w-5 h-5 text-primary mr-2" />
                  Two-Factor Authentication
                </h3>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Status: {user?.twoFactorEnabled ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4 inline" />
                          Enabled
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Disabled</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {user?.twoFactorEnabled 
                        ? 'Your account is protected with two-factor authentication'
                        : 'Add an extra layer of security to your account'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {user?.twoFactorEnabled ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRegenerateDialog(true)}
                          disabled={regenerateLoading}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate Codes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDisable2FA(true)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Disable
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          navigate('/2fa/setup');
                        }}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Enable 2FA
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              <div className="p-6 rounded-lg bg-gradient-to-br from-secondary/5 to-secondary/3 border border-secondary/20">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Lock className="w-5 h-5 text-secondary mr-2" />
                  Change Password
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="focus:border-secondary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                      className="focus:border-secondary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      className="focus:border-secondary"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  >
                    {isChangingPassword ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </div>
                </TabsContent>

                {/* Subscription Tab */}
                

                {/* Danger Zone Tab */}
                <TabsContent value="danger" className="space-y-4">
              <div className="p-6 rounded-lg bg-gradient-to-br from-red-500/5 to-orange-500/5 border border-red-200/20">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
                  <Trash2 className="w-5 h-5 text-red-600 mr-2" />
                  Delete Account
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-red-800 dark:text-red-200">Warning</h4>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          This action cannot be undone. This will permanently delete your account and remove all associated data including:
                        </p>
                        <ul className="text-sm text-red-700 dark:text-red-300 mt-2 ml-4 list-disc">
                          <li>All your chatbots and their configurations</li>
                          <li>All conversation history and analytics</li>
                          <li>All user access permissions</li>
                          <li>All website contexts and crawling data</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <AlertDialog open={showDisable2FA} onOpenChange={setShowDisable2FA}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              Please enter your password and current 2FA code to disable 2FA
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>2FA Code</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={disableOtp}
                onChange={(e) => setDisableOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="mt-2 text-center text-xl tracking-widest font-mono"
                placeholder="000000"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDisable2FA(false);
              setDisablePassword('');
              setDisableOtp('');
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setDisableLoading(true);
                try {
                  const token = localStorage.getItem('auth_token');
                  if (!token) throw new Error('No authentication token found');
                  await disableTwoFactor(disablePassword, disableOtp, token);
                  toast({
                    title: "Success",
                    description: "2FA disabled successfully",
                  });
                  setShowDisable2FA(false);
                  setDisablePassword('');
                  setDisableOtp('');
                  await refreshUser();
                } catch (error) {
                  handleError(error as ApiError);
                } finally {
                  setDisableLoading(false);
                }
              }}
              disabled={disableLoading || disablePassword.length === 0 || disableOtp.length !== 6}
              className="bg-destructive hover:bg-destructive/90"
            >
              {disableLoading ? 'Disabling...' : 'Disable 2FA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Backup Codes Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Backup Codes</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current 2FA code to generate new backup codes
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4">
            <Label>2FA Code</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={regenerateOtp}
              onChange={(e) => setRegenerateOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="mt-2 text-center text-xl tracking-widest font-mono"
              placeholder="000000"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRegenerateDialog(false);
              setRegenerateOtp('');
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setRegenerateLoading(true);
                try {
                  const token = localStorage.getItem('auth_token');
                  if (!token) throw new Error('No authentication token found');
                  const response = await regenerateBackupCodes(regenerateOtp, token);
                  toast({
                    title: "Success",
                    description: `New backup codes:\n\n${response.backupCodes.join('\n')}\n\nPlease save these codes in a safe place.`,
                    duration: 10000,
                  });
                  setShowRegenerateDialog(false);
                  setRegenerateOtp('');
                } catch (error) {
                  handleError(error as ApiError);
                } finally {
                  setRegenerateLoading(false);
                }
              }}
              disabled={regenerateLoading || regenerateOtp.length !== 6}
              className="bg-primary hover:bg-primary/90"
            >
              {regenerateLoading ? 'Generating...' : 'Regenerate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove all associated data. To confirm, please type your email address: <span className="font-bold">{user?.email}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            placeholder="Type your email to confirm"
            className="mt-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmEmail('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmEmail !== user?.email || isDeletingAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingAccount ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
    </>
  );
};

export default UserSettingsModal;