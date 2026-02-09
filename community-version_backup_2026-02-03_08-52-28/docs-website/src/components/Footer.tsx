import nomosLogo from "@/assets/nomos-logo.png";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={nomosLogo} alt="CitadelAI" className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground">CitadelAI Documentation</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Comprehensive documentation for CitadelAI open-source project
          </p>
        </div>
        
        <div className="pt-8 border-t border-border">
          <div className="flex flex-wrap justify-center gap-6 mb-4 text-sm">
            <a
              href="https://citadelai.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Website
            </a>
            <a
              href="https://github.com/rubidev68/citadelai-community"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} CitadelAI. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
