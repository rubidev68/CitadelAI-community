import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

const getTheme = (): 'dark' | 'neutral' => {
  const htmlElement = document.documentElement;
  if (htmlElement.classList.contains('dark')) {
    return 'dark';
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'neutral';
};

const getThemeVariables = (isDark: boolean) => {
  return isDark ? {
    // Dark theme - high contrast for readability
    primaryColor: '#1e293b', // Node background
    primaryTextColor: '#f3f4f6', // Node text (bright on dark)
    primaryBorderColor: '#60a5fa',
    lineColor: '#9ca3af',
    secondaryColor: '#334155',
    tertiaryColor: '#0f172a',
    background: '#0f172a',
    mainBkgColor: '#1e293b', // Main node background
    secondBkgColor: '#334155', // Secondary node background
    textColor: '#f3f4f6', // General text
    edgeLabelBackground: '#1e293b',
    edgeLabelColor: '#f3f4f6', // Edge label text
    clusterBkg: '#1e293b',
    clusterBorder: '#475569',
    defaultLinkColor: '#60a5fa',
    titleColor: '#f3f4f6',
    noteBkgColor: '#1e293b',
    noteTextColor: '#f3f4f6',
    noteBorderColor: '#475569',
    // Flow diagram specific
    nodeBkg: '#1e293b',
    nodeBorder: '#60a5fa',
    defaultTextColor: '#f3f4f6', // Default text color for all elements
    // Sequence diagram specific
    actorBorder: '#60a5fa',
    actorBkg: '#1e293b',
    actorTextColor: '#f3f4f6', // Actor label text
    actorLineColor: '#9ca3af',
    signalColor: '#f3f4f6', // Signal line color
    signalTextColor: '#f3f4f6', // Signal label text
    labelBoxBkgColor: '#1e293b',
    labelBoxBorderColor: '#60a5fa',
    labelTextColor: '#f3f4f6', // Label text in boxes
    loopTextColor: '#f3f4f6', // Loop text
    activationBorderColor: '#60a5fa',
    activationBkgColor: '#334155',
    sequenceNumberColor: '#f3f4f6', // Sequence number text
    // Additional sequence diagram variables
    messageTextColor: '#f3f4f6', // Message label text
    messageLineColor: '#9ca3af', // Message line color
    lifelineBorderColor: '#60a5fa',
    lifelineTextColor: '#f3f4f6',
  } : {
    // Light/neutral theme - high contrast for readability
    primaryColor: '#f3f4f5', // Node background (light)
    primaryTextColor: '#1f2937', // Node text (dark on light)
    primaryBorderColor: '#374151',
    lineColor: '#4b5563',
    secondaryColor: '#e5e7eb',
    tertiaryColor: '#ffffff',
    background: '#ffffff',
    mainBkgColor: '#f3f4f5', // Main node background
    secondBkgColor: '#e5e7eb', // Secondary node background
    textColor: '#1f2937', // General text
    edgeLabelBackground: '#ffffff',
    edgeLabelColor: '#1f2937', // Edge label text
    clusterBkg: '#f9fafb',
    clusterBorder: '#d1d5db',
    defaultLinkColor: '#1f2937',
    titleColor: '#1f2937',
    noteBkgColor: '#f9fafb',
    noteTextColor: '#1f2937',
    noteBorderColor: '#d1d5db',
    // Flow diagram specific
    nodeBkg: '#f3f4f5',
    nodeBorder: '#374151',
    defaultTextColor: '#1f2937', // Default text color for all elements
    // Sequence diagram specific
    actorBorder: '#374151',
    actorBkg: '#f3f4f5',
    actorTextColor: '#1f2937', // Actor label text
    actorLineColor: '#4b5563',
    signalColor: '#1f2937', // Signal line color
    signalTextColor: '#1f2937', // Signal label text
    labelBoxBkgColor: '#f3f4f5',
    labelBoxBorderColor: '#374151',
    labelTextColor: '#1f2937', // Label text in boxes
    loopTextColor: '#1f2937', // Loop text
    activationBorderColor: '#374151',
    activationBkgColor: '#e5e7eb',
    sequenceNumberColor: '#1f2937', // Sequence number text
    // Additional sequence diagram variables
    messageTextColor: '#1f2937', // Message label text
    messageLineColor: '#4b5563', // Message line color
    lifelineBorderColor: '#374151',
    lifelineTextColor: '#1f2937',
  };
};

const MermaidDiagram = ({ code }: { code: string }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'neutral'>(getTheme());

  useEffect(() => {
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const newTheme = getTheme();
      if (newTheme !== theme) {
        setTheme(newTheme);
        setRendered(false); // Force re-render with new theme
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Also listen to system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const newTheme = getTheme();
      if (newTheme !== theme) {
        setTheme(newTheme);
        setRendered(false);
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  useEffect(() => {
    if (mermaidRef.current && !rendered) {
      const isDark = theme === 'dark';
      const themeVars = getThemeVariables(isDark);
      
      // Initialize with theme variables
      mermaid.initialize({ 
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        themeVariables: themeVars,
        // Force text colors for all diagram types
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
        },
        sequence: {
          useMaxWidth: true,
          diagramMarginX: 50,
          diagramMarginY: 10,
          actorMargin: 50,
          width: 150,
          height: 65,
          boxMargin: 10,
          boxTextMargin: 5,
          noteMargin: 10,
          messageMargin: 35,
          mirrorActors: true,
          bottomMarginAdj: 1,
          rightAngles: false,
          showSequenceNumbers: false,
        },
      });
      
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      mermaid.render(id, code).then((result) => {
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = result.svg;
          // Apply additional CSS to ensure text is visible
          const svg = mermaidRef.current.querySelector('svg');
          if (svg) {
            // Force text color for all text elements
            const textElements = svg.querySelectorAll('text, tspan');
            textElements.forEach((el) => {
              const computedStyle = window.getComputedStyle(el);
              const fill = el.getAttribute('fill');
              // If text is too light on light background or too dark on dark background, fix it
              if (isDark && (!fill || fill === 'none' || fill === '#333' || fill === '#333333')) {
                el.setAttribute('fill', '#f3f4f6');
              } else if (!isDark && (!fill || fill === '#fff' || fill === '#ffffff' || fill === '#ddd')) {
                el.setAttribute('fill', '#1f2937');
              }
            });
          }
          setRendered(true);
        }
      }).catch((error) => {
        console.error('Mermaid rendering error:', error);
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `<pre class="text-foreground p-4 bg-muted rounded">${code}</pre>`;
        }
      });
    }
  }, [code, rendered, theme]);

  return (
    <div className="my-6 bg-muted/50 p-4 rounded-lg overflow-x-auto border border-border">
      <div ref={mermaidRef} className="flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"></div>
    </div>
  );
};

const MarkdownRenderer = ({ content }: MarkdownRendererProps) => {
  useEffect(() => {
    // Initialize Mermaid with default settings
    mermaid.initialize({ 
      startOnLoad: false,
      securityLevel: 'loose',
    });
  }, []);

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const isInline = !match;
      
      // Handle Mermaid diagrams
      if (match && match[1] === "mermaid") {
        return <MermaidDiagram code={codeString} />;
      }
      
      return !isInline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...(props as Record<string, unknown>)}
        >
          {codeString}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
