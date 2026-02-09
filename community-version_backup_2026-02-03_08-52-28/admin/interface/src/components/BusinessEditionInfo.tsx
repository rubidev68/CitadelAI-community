import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Crown, Users, ExternalLink, Shield, Zap } from 'lucide-react';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';

const BusinessEditionInfo = () => {
  const { features } = useFeatureFlags();
  const isBusinessEdition = features.versionType === 'proprietary';

  if (!isBusinessEdition) {
    return null; // Don't show business info for open source version
  }

  const handleContactSales = () => {
    window.open('mailto:contact@citadelai.app', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Business Edition Header (kept lightweight) */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Crown className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">Business Edition</h2>
          <Crown className="w-6 h-6 text-yellow-500" />
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Enterprise-ready platform with advanced features, support, and deployment options for organizations of all sizes.
        </p>
        <Badge variant="secondary" className="text-sm px-3 py-1 bg-yellow-50 text-yellow-700 border-yellow-200">
          <Building className="w-4 h-4 mr-1" />
          Enterprise Ready
        </Badge>
      </div>

      {/* Features Grid (updated to match business website) */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Zap className="w-5 h-5 text-blue-600 mr-2" />
              Enterprise Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>Advanced AI capabilities</li>
              <li className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>Enterprise security & compliance</li>
              <li className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>Priority support</li>
              <li className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>Managed hosting options</li>
              <li className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>Teams/Slack integration</li>
              <li className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>Dedicated instances available</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Shield className="w-5 h-5 text-purple-600 mr-2" />
              Business Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-4">
              Get dedicated support and enterprise-grade features for your business needs.
            </p>
            <Button onClick={handleContactSales} className="w-full bg-purple-600 hover:bg-purple-700 text-white" size="sm">
              <Building className="w-4 h-4 mr-2" />
              Contact Sales
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Enterprise Features Status (unchanged) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center p-4">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="w-4 h-4 text-green-600" />
          </div>
          <h4 className="text-sm font-medium text-gray-900">Security</h4>
          <p className="text-xs text-gray-600">Enterprise Grade</p>
        </Card>
        <Card className="text-center p-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <h4 className="text-sm font-medium text-gray-900">User Management</h4>
          <p className="text-xs text-gray-600">Advanced</p>
        </Card>
        <Card className="text-center p-4">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          <h4 className="text-sm font-medium text-gray-900">Analytics</h4>
          <p className="text-xs text-gray-600">Advanced</p>
        </Card>
        <Card className="text-center p-4">
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Crown className="w-4 h-4 text-yellow-600" />
          </div>
          <h4 className="text-sm font-medium text-gray-900">Support</h4>
          <p className="text-xs text-gray-600">Priority</p>
        </Card>
      </div>
    </div>
  );
};

export default BusinessEditionInfo;
