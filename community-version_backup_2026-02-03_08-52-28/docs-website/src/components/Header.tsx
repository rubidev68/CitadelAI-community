import { Link } from "react-router-dom";
import nomosLogo from "@/assets/nomos-logo.png";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6 py-4">
        <nav className="flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img src={nomosLogo} alt="CitadelAI Logo" className="h-10 w-10" />
            <span className="text-2xl font-bold text-foreground">CitadelAI Docs</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <a
              href="https://citadelai.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Website
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
