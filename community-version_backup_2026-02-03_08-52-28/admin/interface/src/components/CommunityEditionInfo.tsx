import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Github, Heart, Users, Code, Star, ExternalLink } from 'lucide-react';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';

const CommunityEditionInfo = () => {
  const { features } = useFeatureFlags();
  const isCommunityEdition = features.versionType === 'opensource';

  if (!isCommunityEdition) {
    return null; // Don't show community info for proprietary version
  }

  const handleContributeClick = () => {
    // Open GitHub repository in new tab
    window.open('https://github.com/rubidev68/CitadelAI', '_blank', 'noopener,noreferrer');
  };

  const handleStarClick = () => {
    // Open GitHub repository stars page
    window.open('https://github.com/rubidev68/CitadelAI/stargazers', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Community Edition Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Heart className="w-6 h-6 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900">Community Edition</h2>
          <Heart className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          You're using the open-source version of CitadelAI, built with love by the community for the community.
        </p>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          <Code className="w-4 h-4 mr-1" />
          Open Source
        </Badge>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Users className="w-5 h-5 text-green-600 mr-2" />
              Community Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                AI Chatbot Builder
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                Web Crawling Service
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                Vector Search with Weaviate
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                Real-time Streaming
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                Basic Analytics
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Star className="w-5 h-5 text-blue-600 mr-2" />
              Get Involved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-4">
              Help us improve CitadelAI by contributing to the project or supporting our work.
            </p>
            <div className="space-y-2">
              <Button
                onClick={handleContributeClick}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                size="sm"
              >
                <Github className="w-4 h-4 mr-2" />
                Contribute on GitHub
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
              <Button
                onClick={handleStarClick}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Star className="w-4 h-4 mr-2" />
                Star the Project
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Version Information */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Version Information</CardTitle>
          <CardDescription>
            Current version details and build information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Edition:</span>
              <span className="ml-2 text-gray-900">Community (Open Source)</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Version:</span>
              <span className="ml-2 text-gray-900">1.0.0</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">License:</span>
              <span className="ml-2 text-gray-900">MIT</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Build:</span>
              <span className="ml-2 text-gray-900">Development</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Love CitadelAI? Help us grow! 🌟
        </h3>
        <p className="text-gray-600 mb-4">
          Your contributions help make CitadelAI better for everyone. Every star, issue report, and pull request makes a difference.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleContributeClick}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            <Github className="w-4 h-4 mr-2" />
            Contribute Code
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
          <Button
            onClick={handleStarClick}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50"
          >
            <Star className="w-4 h-4 mr-2" />
            Star on GitHub
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommunityEditionInfo;
