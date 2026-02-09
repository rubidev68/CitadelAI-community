import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Crown, Zap, PhoneCall, AlertTriangle } from 'lucide-react';
import EnterpriseContactForm from '@/components/EnterpriseContactForm';

interface TrialExpiredModalProps {
  open: boolean;
}

const TrialExpiredModal: React.FC<TrialExpiredModalProps> = ({ open }) => {
  const { plans, updateSubscription } = useSubscription();
  const [contactOpen, setContactOpen] = useState(false);
  const [loading, setLoading] = useState<'pro' | 'starter' | null>(null);

  const proPlanId = useMemo(() => 
    plans.find(p => p.name.toLowerCase() === 'pro' || p.name.toLowerCase() === 'professional')?.id || null, 
    [plans]
  );
  const starterPlanId = useMemo(() => 
    plans.find(p => p.name.toLowerCase() === 'starter')?.id || null, 
    [plans]
  );

  const handleChoosePro = async () => {
    if (!proPlanId) return;
    try {
      setLoading('pro');
      await updateSubscription(proPlanId);
    } finally {
      setLoading(null);
    }
  };

  const handleChooseStarter = async () => {
    if (!starterPlanId) return;
    try {
      setLoading('starter');
      await updateSubscription(starterPlanId);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => { /* non-dismissible */ }}>
        <DialogContent className="max-w-xl" hideClose={true}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Your trial has ended</span>
            </DialogTitle>
            <DialogDescription>
              Choose how you want to continue using the admin dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Crown className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-medium">Subscribe to Pro</div>
                    <div className="text-sm text-muted-foreground">Unlock all features and keep your setup</div>
                  </div>
                </div>
                <Button onClick={handleChoosePro} disabled={!proPlanId || loading !== null}>
                  {loading === 'pro' ? 'Subscribing…' : 'Choose Pro'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium">Switch to Starter</div>
                    <div className="text-sm text-muted-foreground">Continue with reduced limits</div>
                  </div>
                </div>
                <Button variant="outline" onClick={handleChooseStarter} disabled={!starterPlanId || loading !== null}>
                  {loading === 'starter' ? 'Switching…' : 'Choose Starter'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <PhoneCall className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="font-medium">Contact us</div>
                    <div className="text-sm text-muted-foreground">Discuss Enterprise or tailored options</div>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setContactOpen(true)}>
                  Contact
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <EnterpriseContactForm isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
};

export default TrialExpiredModal;
