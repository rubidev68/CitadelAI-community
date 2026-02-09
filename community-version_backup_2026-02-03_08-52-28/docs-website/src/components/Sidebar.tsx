import { Link, useLocation } from "react-router-dom";
import { Home, Code, Book, Code2, Server, Users, Shield, Globe, Ban, Rocket, Settings, FileText, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

const Sidebar = () => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    // Auto-expand sections if a child is active on initial load
    const initial: string[] = [];
    if (location.pathname.startsWith("/api/")) initial.push("/api");
    if (location.pathname.startsWith("/configuration/") || 
        location.pathname.startsWith("/deployment/") ||
        location.pathname.startsWith("/usage/") ||
        location.pathname.startsWith("/troubleshooting/")) {
      initial.push("/guides");
    }
    return initial.length > 0 ? initial : ["/api"];
  });

  // Auto-expand when location changes
  useEffect(() => {
    const newExpanded: string[] = [...expandedSections];
    
    if (location.pathname.startsWith("/api/") && !newExpanded.includes("/api")) {
      newExpanded.push("/api");
    }
    if ((location.pathname.startsWith("/configuration/") || 
         location.pathname.startsWith("/deployment/") ||
         location.pathname.startsWith("/usage/") ||
         location.pathname.startsWith("/troubleshooting/")) && 
        !newExpanded.includes("/guides")) {
      newExpanded.push("/guides");
    }
    
    if (newExpanded.length !== expandedSections.length) {
      setExpandedSections(newExpanded);
    }
  }, [location.pathname]);

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/getting-started", label: "Getting Started", icon: Rocket },
    { 
      path: "/architecture/overview", 
      label: "Architecture", 
      icon: Code
    },
    {
      path: "/api/overview",
      label: "API Reference",
      icon: Code2,
      children: [
        { path: "/api/user-service", label: "User Service", icon: Users },
        { path: "/api/admin-service", label: "Admin Service", icon: Shield },
        { path: "/api/crawling-service", label: "Crawling Service", icon: Globe },
      ]
    },
    { 
      path: "/services/overview", 
      label: "Services", 
      icon: Server 
    },
    {
      path: "/guides",
      label: "Guides",
      icon: FileText,
      children: [
        { path: "/configuration/reference", label: "Configuration", icon: Settings },
        { path: "/deployment/guide", label: "Deployment", icon: Rocket },
        { path: "/usage/examples", label: "Usage Examples", icon: Code2 },
        { path: "/troubleshooting/guide", label: "Troubleshooting", icon: AlertCircle },
      ]
    },
    { path: "/what-is-excluded", label: "What's Excluded", icon: Ban },
    { path: "/contributing/guide", label: "Contributing", icon: Book },
  ];

  const toggleSection = (path: string) => {
    setExpandedSections(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  return (
    <aside className="w-64 border-r border-border bg-card/50 p-6 overflow-y-auto">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.children && item.children.some(child => location.pathname === child.path));
          const isExpanded = item.children && expandedSections.includes(item.path);
          
          return (
            <div key={item.path}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleSection(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                              isChildActive
                                ? "bg-primary/20 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            }`}
                          >
                            <ChildIcon className="h-4 w-4" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
