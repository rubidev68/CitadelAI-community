import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, GitBranch, Shield, Globe, Users, Code, BookOpen, MessageSquare, Github } from 'lucide-react';

const CustomInstanceInfo = () => {
  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto p-6">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-rose-50 rounded-full mb-4">
          <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Community Edition</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Open source, self-hosted, and free forever.
        </p>
        
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Badge variant="outline" className="px-3 py-1 border-emerald-200 bg-emerald-50 text-emerald-700">
            <GitBranch className="w-3 h-3 mr-1.5" />
            Open Source
          </Badge>
          <Badge variant="outline" className="px-3 py-1 border-blue-200 bg-blue-50 text-blue-700">
            <Shield className="w-3 h-3 mr-1.5" />
            Self-Hosted
          </Badge>
          <Badge variant="outline" className="px-3 py-1 border-purple-200 bg-purple-50 text-purple-700">
            <Code className="w-3 h-3 mr-1.5" />
            MIT License
          </Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Users className="w-5 h-5 mr-2 text-primary" />
              Unlimited Users & Chatbots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No limits on the number of team members or AI agents you can deploy.
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Shield className="w-5 h-5 mr-2 text-primary" />
              Data Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your data never leaves your infrastructure. Full control over compliance.
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Code className="w-5 h-5 mr-2 text-primary" />
              Full Source Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Customize every aspect of the platform. Build your own integrations.
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <GitBranch className="w-5 h-5 mr-2 text-primary" />
              Community Driven
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Built by the community, for the community.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="https://docs.citadelai.app" target="_blank" rel="noopener noreferrer" className="block">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-dashed">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
              <BookOpen className="w-6 h-6 text-muted-foreground" />
              <span className="font-semibold">Documentation</span>
            </CardContent>
          </Card>
        </a>
        
        <a href="https://discord.gg/citadelai" target="_blank" rel="noopener noreferrer" className="block">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-dashed">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
              <span className="font-semibold">Discord</span>
            </CardContent>
          </Card>
        </a>

        <a href="https://github.com/rubidev68/citadelai-community" target="_blank" rel="noopener noreferrer" className="block">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-dashed">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
              <Github className="w-6 h-6 text-muted-foreground" />
              <span className="font-semibold">GitHub</span>
            </CardContent>
          </Card>
        </a>
      </div>
    </div>
  );
};

export default CustomInstanceInfo;
