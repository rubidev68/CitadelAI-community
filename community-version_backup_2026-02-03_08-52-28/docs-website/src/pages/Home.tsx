import { Link } from "react-router-dom";
import { BookOpen, Code, Users, ArrowRight, Code2, Server, Shield, Rocket, Settings, FileText, AlertCircle } from "lucide-react";

const Home = () => {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-5xl font-bold text-foreground mb-4">
          CitadelAI Documentation
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Comprehensive documentation for CitadelAI - 
          Learn how to use the API, understand services, and contribute to the open-source project.
        </p>
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="text-3xl font-semibold text-foreground mb-6">Quick Start</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/getting-started"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <Rocket className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Getting Started
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Install and run CitadelAI in minutes - complete setup guide
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/api/overview"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <Code2 className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                API Reference
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Complete API documentation for all services - User, Admin, and Crawling services
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/services/overview"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <Server className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Services Overview
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Understand all microservices, their responsibilities, and interactions
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/architecture/overview"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <Code className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Architecture
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Understand the system architecture and component structure
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/contributing/guide"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <Users className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Contributing
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Guidelines for contributing to CitadelAI
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/usage/examples"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <FileText className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Usage Examples
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Practical examples and code samples for using CitadelAI APIs
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/configuration/reference"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <Settings className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Configuration
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Complete reference for environment variables and configuration options
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/troubleshooting/guide"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <AlertCircle className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Troubleshooting
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Common issues, solutions, and debugging tips
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/what-is-excluded"
            className="group p-6 border border-border rounded-lg hover:border-primary transition-colors bg-card"
          >
            <div className="flex items-center gap-4 mb-4">
              <Shield className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                What's Excluded
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Learn what features are excluded from the open-source version
            </p>
            <div className="flex items-center text-primary group-hover:gap-2 transition-all">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
