import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Cloud, 
  AlertCircle, 
  BookOpen, 
  Key, 
  Settings, 
  Info, 
  ChevronRight, 
  CheckCircle2,
  XCircle,
  RefreshCw,
  Folder,
  FileText,
  Shield,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const CloudBlockDocsPage = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');

  const sections: Section[] = [
    { id: 'overview', title: 'Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'getting-started', title: 'Getting Started', icon: <Zap className="h-4 w-4" /> },
    { id: 'authentication', title: 'Authentication', icon: <Key className="h-4 w-4" /> },
    { id: 'configuration', title: 'Configuration', icon: <Settings className="h-4 w-4" /> },
    { id: 'how-it-works', title: 'How It Works', icon: <Cloud className="h-4 w-4" /> },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: <AlertCircle className="h-4 w-4" /> },
    { id: 'security', title: 'Security', icon: <Shield className="h-4 w-4" /> },
    { id: 'best-practices', title: 'Best Practices', icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      for (const section of sections) {
        const element = sectionRefs.current[section.id];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="sticky top-0 h-screen w-64 border-r border-border bg-card/50 backdrop-blur-sm">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Cloud className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Navigation</h2>
                </div>
                <p className="text-xs text-muted-foreground">Cloud Block Guide</p>
              </div>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
                      'hover:bg-primary/10 hover:text-foreground',
                      activeSection === section.id
                        ? 'bg-primary/20 text-primary font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    <span className={cn(activeSection === section.id ? 'text-primary' : 'text-muted-foreground')}>
                      {section.icon}
                    </span>
                    <span className="flex-1 text-left">{section.title}</span>
                    {activeSection === section.id && (
                      <ChevronRight className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="container mx-auto max-w-5xl px-8 py-8">
            {/* Header */}
            <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Cloud className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-3xl font-bold text-foreground">Cloud Block Documentation</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Complete guide to integrating cloud storage with your chatbot
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-6">
              {/* Overview */}
              <div ref={(el) => (sectionRefs.current['overview'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      The Cloud Block enables your chatbots to access and search files stored in cloud storage services like Nextcloud and Google Drive. 
                      This allows your chatbot to answer questions based on documents stored in your cloud storage without copying everything into the system.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Cloud className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-foreground">Multiple Providers</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Support for Nextcloud and Google Drive (OneDrive coming soon)
                        </p>
                      </div>
                      
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-foreground">Hybrid Indexing</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Only metadata and summaries stored, full content fetched on-demand
                        </p>
                      </div>
                      
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-foreground">Two Auth Methods</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          App Password (simple) or OAuth 2.0 (secure)
                        </p>
                      </div>
                      
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <RefreshCw className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-foreground">Auto-Refresh</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Automatically re-index files on a schedule
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Getting Started */}
              <div ref={(el) => (sectionRefs.current['getting-started'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Getting Started
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-foreground">Step 1: Add Cloud Block</h3>
                      <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                        <li>Open your chatbot in the builder</li>
                        <li>Drag the <strong className="text-foreground">Cloud</strong> block from the Context category onto the canvas</li>
                        <li>Connect it to your System Prompt block</li>
                        <li>Click on the Cloud block to configure it</li>
                      </ol>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-foreground">Step 2: Select Provider</h3>
                      <p className="text-muted-foreground mb-3">
                        In the Cloud block properties panel:
                      </p>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2 text-foreground">Nextcloud</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                            <li>Select <strong className="text-foreground">Nextcloud</strong> as provider</li>
                            <li>Enter your <strong className="text-foreground">Nextcloud Server URL</strong> (e.g., <code className="bg-muted px-1 rounded">https://cloud.example.com</code>)</li>
                          </ol>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2 text-foreground">Google Drive</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                            <li>Select <strong className="text-foreground">Google Drive</strong> as provider</li>
                            <li>Click <strong className="text-foreground">"Connect to Google Drive"</strong> button</li>
                            <li>Authorize access in the popup window</li>
                            <li>No server URL or credentials needed - OAuth is configured globally by your administrator</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-foreground">Step 3: Select Folders/Files to Index</h3>
                      <p className="text-muted-foreground mb-3">
                        After connecting, select which folders and files to index:
                      </p>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold mb-2 text-foreground">Nextcloud</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Click <strong className="text-foreground">"Browse Folders"</strong> to see folder structure</li>
                            <li>Select folders by checking the boxes</li>
                            <li>Default: root folder (all files)</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2 text-foreground">Google Drive</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Click <strong className="text-foreground">"Select Folders/Files"</strong> to open the picker</li>
                            <li>Browse your Google Drive folder structure</li>
                            <li>Select specific folders and/or individual files</li>
                            <li>Selected items appear in the "Selected Items" section</li>
                          </ul>
                        </div>
                        <div className="mt-3">
                          <p className="text-sm text-muted-foreground">
                            <strong className="text-foreground">File Type Filters:</strong> Filter by file extension (optional)<br/>
                            <strong className="text-foreground">Auto-Refresh:</strong> Enable automatic re-indexing on a schedule
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-foreground">Step 4: Index Files</h3>
                      <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                        <li>Click <strong className="text-foreground">"Index Now"</strong> to start indexing files</li>
                        <li>Watch the progress in the indexing status</li>
                        <li>Wait for indexing to complete (may take a few minutes for large folders)</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Authentication */}
              <div ref={(el) => (sectionRefs.current['authentication'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      Authentication Methods
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* App Password */}
                    <div className="rounded-lg border-l-4 border-green-500 bg-green-500/5 p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge className="bg-green-600 text-white">Recommended</Badge>
                        <h3 className="text-xl font-semibold text-foreground">App Password (Simplest)</h3>
                      </div>
                      <p className="mb-4 text-muted-foreground">
                        No OAuth setup required! Just generate an App Password in Nextcloud and use it directly.
                      </p>
                      
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold mb-2 text-foreground">Generate App Password:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Log in to your Nextcloud instance</li>
                            <li>Go to <strong className="text-foreground">Settings</strong> → <strong className="text-foreground">Security</strong> → <strong className="text-foreground">Devices & sessions</strong></li>
                            <li>Scroll to <strong className="text-foreground">"Create new app password"</strong></li>
                            <li>Enter a name (e.g., "CitadelAI")</li>
                            <li>Click <strong className="text-foreground">"Create new app password"</strong></li>
                            <li><strong className="text-foreground">Copy the generated password</strong> (format: <code className="bg-muted px-1 rounded">xxxx-xxxx-xxxx-xxxx</code>)</li>
                            <li>⚠️ <strong className="text-foreground">Important:</strong> This password is shown only once - save it securely!</li>
                          </ol>
                        </div>
                        
                        <Alert className="border-green-500/20 bg-green-500/5">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <AlertDescription>
                            <strong className="text-foreground">That's it!</strong> No OAuth setup needed. Just enter your username and app password in CitadelAI.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>

                    {/* OAuth */}
                    <div className="rounded-lg border-l-4 border-blue-500 bg-blue-500/5 p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge className="bg-blue-600 text-white">More Secure</Badge>
                        <h3 className="text-xl font-semibold text-foreground">OAuth 2.0</h3>
                      </div>
                      <p className="mb-4 text-muted-foreground">
                        More secure token-based authentication. Available for both Nextcloud and Google Drive.
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2 text-foreground">Nextcloud OAuth Setup:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Enable OAuth 2.0 app in Nextcloud (Settings → Apps → OAuth 2.0)</li>
                            <li>Go to Settings → Security → OAuth clients</li>
                            <li>Click "Add client"</li>
                            <li>Enter a name (e.g., "CitadelAI")</li>
                            <li>Set redirect URI: <code className="bg-muted px-1 rounded">https://api.citadelai.app/api/admin/cloud/oauth/callback</code></li>
                            <li>Click "Add"</li>
                            <li>Copy the <strong className="text-foreground">Client Identifier</strong> and <strong className="text-foreground">Secret</strong></li>
                            <li>Enter credentials in CitadelAI and click "Connect"</li>
                          </ol>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="font-semibold mb-2 text-foreground">Google Drive OAuth:</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            Google Drive uses <strong className="text-foreground">global OAuth credentials</strong> configured by your system administrator. 
                            You don't need to set up anything!
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Select <strong className="text-foreground">Google Drive</strong> as provider</li>
                            <li>Click <strong className="text-foreground">"Connect to Google Drive"</strong></li>
                            <li>Authorize access in the popup window</li>
                            <li>That's it! No credentials needed.</li>
                          </ol>
                          <Alert className="border-blue-500/20 bg-blue-500/5 mt-3">
                            <Info className="h-4 w-4 text-blue-500" />
                            <AlertDescription className="text-sm">
                              <strong className="text-foreground">For Administrators:</strong> OAuth credentials must be configured globally in the backend environment variables. 
                              Contact your system administrator if Google Drive connection is not available.
                            </AlertDescription>
                          </Alert>
                        </div>
                        
                        <Alert className="border-blue-500/20 bg-blue-500/5">
                          <Info className="h-4 w-4 text-blue-500" />
                          <AlertDescription>
                            After entering credentials (Nextcloud) or clicking Connect (Google Drive), authorize the app in the popup window.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Configuration */}
              <div ref={(el) => (sectionRefs.current['configuration'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Configuration Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2 text-foreground">Connection Settings</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong className="text-foreground">Provider:</strong> Cloud storage provider (Nextcloud, Google Drive, OneDrive)</li>
                        <li><strong className="text-foreground">Server URL:</strong> Your Nextcloud server URL (Nextcloud only)</li>
                        <li><strong className="text-foreground">Authentication Method:</strong> 
                          <ul className="list-disc list-inside ml-4 mt-1">
                            <li><strong>Nextcloud:</strong> App Password or OAuth 2.0</li>
                            <li><strong>Google Drive:</strong> OAuth 2.0 only (configured globally)</li>
                          </ul>
                        </li>
                        <li><strong className="text-foreground">Connection Status:</strong> Shows if connected and when</li>
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2 text-foreground">Indexing Settings</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong className="text-foreground">Selected Paths/IDs:</strong> 
                          <ul className="list-disc list-inside ml-4 mt-1">
                            <li><strong>Nextcloud:</strong> Folder paths to index (empty = root folder)</li>
                            <li><strong>Google Drive:</strong> Folder/file IDs selected via picker</li>
                          </ul>
                        </li>
                        <li><strong className="text-foreground">File Type Filters:</strong> Filter by file extension (optional)</li>
                        <li><strong className="text-foreground">Auto-Refresh:</strong> Enable automatic re-indexing</li>
                        <li><strong className="text-foreground">Refresh Interval:</strong> Hours between auto-refresh (default: 24 hours)</li>
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2 text-foreground">Indexing Status</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong className="text-foreground">Status:</strong> Current indexing state (idle, indexing, completed, error)</li>
                        <li><strong className="text-foreground">Indexed Files:</strong> Number of files successfully indexed</li>
                        <li><strong className="text-foreground">Last Indexed:</strong> Timestamp of last successful indexing</li>
                        <li><strong className="text-foreground">Indexing Error:</strong> Error message if indexing failed</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* How It Works */}
              <div ref={(el) => (sectionRefs.current['how-it-works'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-primary" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">Hybrid Indexing Approach</h3>
                      <p className="text-muted-foreground mb-4">
                        The Cloud Block uses a hybrid approach to avoid copying all files into the system:
                      </p>
                      
                      <div className="space-y-4">
                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground">1. Metadata Storage</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Only essential metadata is stored in Weaviate:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                            <li>File paths and names</li>
                            <li>File types and sizes</li>
                            <li>Modification dates</li>
                            <li>LLM-generated summaries (for text content)</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground">2. On-Demand Content Retrieval</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            When a user asks a question:
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                            <li>The system searches metadata/summaries in Weaviate</li>
                            <li>Identifies relevant files</li>
                            <li>Fetches actual file content from your cloud storage (only for relevant files)</li>
                            <li>Uses the content to generate an answer</li>
                          </ol>
                        </div>

                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground">3. Caching</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Fetched file content is cached in memory for 1 hour to improve performance.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">File Processing</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong className="text-foreground">PDF Files:</strong> Text is extracted from PDFs</li>
                        <li><strong className="text-foreground">Markdown Files:</strong> Processed as-is</li>
                        <li><strong className="text-foreground">Text Files:</strong> Processed directly</li>
                        <li><strong className="text-foreground">Google Workspace Files:</strong> 
                          <ul className="list-disc list-inside ml-4 mt-1">
                            <li>Google Docs: Exported as text</li>
                            <li>Google Sheets: Exported as CSV</li>
                            <li>Google Slides: Exported as PDF</li>
                          </ul>
                        </li>
                        <li><strong className="text-foreground">File Size Limit:</strong> Files larger than 10MB are skipped</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Troubleshooting */}
              <div ref={(el) => (sectionRefs.current['troubleshooting'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      Troubleshooting
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">Connection Issues</h3>
                      
                      <div className="space-y-3">
                        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                          <h4 className="font-semibold mb-2 text-foreground">Cannot connect to Nextcloud</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Check Server URL is correct and accessible</li>
                            <li>Verify credentials (username/app password or OAuth)</li>
                            <li>Check network connectivity</li>
                            <li>SSL certificates are automatically handled (self-signed certs supported)</li>
                            <li>Ensure ports 80/443 are accessible</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                          <h4 className="font-semibold mb-2 text-foreground">Cannot connect to Google Drive</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Check if OAuth credentials are configured (contact administrator)</li>
                            <li>Verify popup blocker is disabled</li>
                            <li>Check browser console for errors</li>
                            <li>Ensure you're using HTTPS in production</li>
                            <li>Try a different browser if popup doesn't open</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                          <h4 className="font-semibold mb-2 text-foreground">OAuth popup doesn't open</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Check browser popup blocker settings</li>
                            <li>Try a different browser</li>
                            <li>Check browser console for errors</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                          <h4 className="font-semibold mb-2 text-foreground">OAuth callback timeout</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Check network connectivity</li>
                            <li>Verify backend can reach Nextcloud server</li>
                            <li>Check Nextcloud logs for errors</li>
                            <li>Verify OAuth app is properly configured</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">Indexing Issues</h3>
                      
                      <div className="space-y-3">
                        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                          <h4 className="font-semibold mb-2 text-foreground">No files are being indexed</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Check Selected Paths are correct and accessible</li>
                            <li>Check File Types match supported types (PDF, Markdown, Text)</li>
                            <li>Check File Size (files larger than 10MB are skipped)</li>
                            <li>Check Permissions (ensure account has read access)</li>
                            <li>Check Logs for error messages</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                          <h4 className="font-semibold mb-2 text-foreground">Indexing is slow</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Reduce scope (index fewer folders or use file type filters)</li>
                            <li>Check network connection speed</li>
                            <li>Large numbers of files take time to process</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                          <h4 className="font-semibold mb-2 text-foreground">Some files are not indexed</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Only PDF, Markdown, and text files are supported</li>
                            <li>Files larger than 10MB are skipped</li>
                            <li>Ensure account has read access</li>
                            <li>Some PDFs may not have extractable text</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">Search Issues</h3>
                      
                      <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/5 p-4">
                        <h4 className="font-semibold mb-2 text-foreground">Chatbot doesn't find relevant files</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                          <li>Try re-indexing files to update summaries</li>
                          <li>Check indexing status completed successfully</li>
                          <li>Use more specific queries</li>
                          <li>Ensure files contain relevant content</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Security */}
              <div ref={(el) => (sectionRefs.current['security'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Security Considerations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">App Password Security</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong className="text-foreground">One-Time Display:</strong> App passwords are shown only once - save them securely</li>
                        <li><strong className="text-foreground">Revocable:</strong> You can revoke app passwords in Nextcloud settings</li>
                        <li><strong className="text-foreground">Scoped Access:</strong> App passwords only have access to files the account can access</li>
                        <li><strong className="text-foreground">Not Encrypted:</strong> App passwords are stored in block properties (not encrypted) - use OAuth for higher security</li>
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">OAuth Security</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong className="text-foreground">Token Encryption:</strong> OAuth tokens are encrypted before storage</li>
                        <li><strong className="text-foreground">Automatic Refresh:</strong> Access tokens are automatically refreshed when expired</li>
                        <li><strong className="text-foreground">Scoped Access:</strong> OAuth tokens only have read access to files</li>
                        <li><strong className="text-foreground">Revocable:</strong> You can revoke access in Nextcloud OAuth settings</li>
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-3 text-foreground">General Security</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                        <li><strong className="text-foreground">HTTPS:</strong> Always use HTTPS for Nextcloud connections</li>
                        <li><strong className="text-foreground">Access Control:</strong> Only index folders that contain non-sensitive information</li>
                        <li><strong className="text-foreground">Regular Review:</strong> Periodically review indexed files and remove unnecessary ones</li>
                        <li><strong className="text-foreground">Disconnect:</strong> Disconnect cloud storage if no longer needed</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Best Practices */}
              <div ref={(el) => (sectionRefs.current['best-practices'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Best Practices
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                      <li><strong className="text-foreground">Use App Password for Testing (Nextcloud):</strong> App Password is simpler for initial setup and testing</li>
                      <li><strong className="text-foreground">Use OAuth for Production:</strong> OAuth provides better security for production environments</li>
                      <li><strong className="text-foreground">Google Drive:</strong> Uses global OAuth - just click Connect, no setup needed</li>
                      <li><strong className="text-foreground">Selective Indexing:</strong> Only index folders/files that contain relevant information</li>
                      <li><strong className="text-foreground">Use Folder/File Picker:</strong> For Google Drive, use the picker to select specific items instead of indexing everything</li>
                      <li><strong className="text-foreground">Regular Re-indexing:</strong> Enable auto-refresh to keep content up-to-date</li>
                      <li><strong className="text-foreground">Monitor Indexing:</strong> Check indexing status regularly to ensure it's working</li>
                      <li><strong className="text-foreground">File Organization:</strong> Organize files in your cloud storage for easier indexing</li>
                      <li><strong className="text-foreground">Naming Conventions:</strong> Use descriptive file names for better search results</li>
                      <li><strong className="text-foreground">File Size:</strong> Keep files under 10MB for indexing</li>
                      <li><strong className="text-foreground">Backup:</strong> Keep backups of important files outside of cloud storage</li>
                      <li><strong className="text-foreground">Documentation:</strong> Document which folders/files are indexed for your team</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CloudBlockDocsPage;
