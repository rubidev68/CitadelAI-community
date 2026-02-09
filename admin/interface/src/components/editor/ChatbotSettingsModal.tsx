import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Mail, Shield, Activity, Users, Crown, AlertTriangle, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { useAuth } from '@/contexts/AuthContext';

import { getChatbotUsers, addChatbotUser, removeChatbotUser, getMe, deleteChatbot } from '@/lib/api';
import { useErrorHandler, ApiError } from '@/hooks/useErrorHandler';
import { USER_INTERFACE_URL } from '@/lib/apiClient';
import TutorialTrigger from '../tutorial/TutorialTrigger';

const ChatbotSettingsModal = ({ open, onOpenChange }: ChatbotSettingsModalProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuth();
  const { handleError } = useErrorHandler(logout);
  const refreshSubscription = async () => {};
  const { ownerId, chatbotName } = useBlockEditor();
  
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [testUserId, setTestUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('auth_token');
      if (id && token) {
        try {
          const users = await getChatbotUsers(id, token);
          setAllowedUsers(users);

          const me = await getMe(token);
          setTestUserId(me.testUserId);
        } catch (error) {
          console.error("Failed to fetch data:", error);
          handleError(error as ApiError);
        }
      }
    };

    if (open) {
      fetchData();
    }
  }, [open, id, handleError]);

  const handleAddUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (id && newUserEmail.trim() && token) {
      try {
        await addChatbotUser(id, newUserEmail.trim(), token);
        const users = await getChatbotUsers(id, token);
        setAllowedUsers(users);
        setNewUserEmail('');
        setIsAddingUser(false);
        toast({
          title: "User Added",
          description: `${newUserEmail} can now access this chatbot.`,
        });
      } catch (error: Error) {
        console.error("Failed to add user:", error);
        handleError(error as ApiError);
        toast({
          title: "Error",
          description: error.message || "Could not add user.",
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveUser = async (accessId: string) => {
    const token = localStorage.getItem('auth_token');
    if (id && token) {
      try {
        await removeChatbotUser(id, accessId, token);
        const users = await getChatbotUsers(id, token);
        setAllowedUsers(users);
        toast({
          title: "User Removed",
          description: "User access has been revoked.",
        });
      } catch (error: Error) {
        console.error("Failed to remove user:", error);
        handleError(error as ApiError);
        toast({
          title: "Error",
          description: error.message || "Could not remove user.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteChatbot = async () => {
    const token = localStorage.getItem('auth_token');
    if (id && token) {
      try {
        await deleteChatbot(id, token);
        
        // Refresh subscription data after successful deletion
        // The backend cache is automatically invalidated, so this will get the correct count
        await refreshSubscription();
        
        toast({
          title: "Chatbot Deleted",
          description: `The chatbot "${chatbotName}" has been permanently deleted.`,
        });
        onOpenChange(false);
        navigate('/');
      } catch (error) {
        console.error("Failed to delete chatbot:", error);
        handleError(error as ApiError);
        toast({
          title: "Error",
          description: "Could not delete the chatbot.",
          variant: "destructive",
        });
        // Refresh on error to ensure UI is in sync
        await refreshSubscription();
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg mr-3">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              Chatbot Settings
            </DialogTitle>
            <DialogDescription>
              Manage user access and settings for your chatbot
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="users" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Users</span>
              </TabsTrigger>
              <TabsTrigger value="tutorial" className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span>Tutorial</span>
              </TabsTrigger>
              <TabsTrigger value="danger" className="flex items-center space-x-2 text-red-500">
                <AlertTriangle className="w-4 h-4" />
                <span>Danger Zone</span>
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Allowed Users</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage who can access this chatbot at <a href={USER_INTERFACE_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{USER_INTERFACE_URL}</a>
                  </p>
                </div>
                {!isAddingUser ? (
                  <Button 
                    size="sm" 
                    onClick={() => setIsAddingUser(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add User
                  </Button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Input
                      type="email"
                      placeholder="user@company.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddUser();
                        if (e.key === 'Escape') setIsAddingUser(false);
                      }}
                      className="w-48"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleAddUser} disabled={!newUserEmail.trim()}>
                      Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setIsAddingUser(false);
                      setNewUserEmail('');
                    }}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allowedUsers
                  .filter((access) => access.userId !== testUserId)
                  .map((access) => {
                  const isOwner = access.userId === ownerId;
                  return (
                    <div key={access.id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border hover:bg-card/80 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Mail className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm flex items-center">
                            {access.userEmail}
                            {isOwner && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                <Crown className="w-3 h-3 mr-1" />
                                Owner
                              </Badge>
                            )}
                          </p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {access.user ? (
                              <>
                                <Shield className="w-3 h-3 mr-1" />
                                {access.user.role}
                              </>
                            ) : (
                              'Pending'
                            )}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(access.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={isOwner}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Tutorial Tab */}
            <TabsContent value="tutorial" className="space-y-4">
              <div className="p-6 rounded-lg border bg-card">
                <h3 className="font-medium mb-2">Interactive Tutorial</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Learn how to use the chatbot builder with our step-by-step tutorial.
                </p>
                <TutorialTrigger onTutorialStart={() => onOpenChange(false)} />
              </div>
            </TabsContent>

            {/* Danger Zone Tab */}
            <TabsContent value="danger" className="space-y-4">
              <div className="p-6 rounded-lg border border-destructive/20 bg-destructive/5">
                <h3 className="font-medium text-red-500">Delete Chatbot</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This action is irreversible. All data associated with this chatbot will be permanently deleted.
                </p>
                <Button 
                  variant="destructive" 
                  className="mt-4"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Chatbot
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chatbot
              and remove all associated data. To confirm, please type the name of the
              chatbot: <span className="font-bold">{chatbotName}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder="Type the chatbot name to confirm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmName('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChatbot}
              disabled={deleteConfirmName !== chatbotName}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ChatbotSettingsModal;
