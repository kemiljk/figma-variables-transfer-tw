import * as React from "react";
import { CollectionExport } from "../code";
import { Copy, Check, Download } from 'lucide-react';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { lazy } from 'react';

// Lazy load the syntax highlighter and language
const LazyHighlighter = React.lazy(() => import('react-syntax-highlighter/dist/esm/light'));
const LazyJson = React.lazy(() => import('react-syntax-highlighter/dist/esm/languages/hljs/json'));

// Custom theme using our CSS variables
const customTheme = {
  hljs: {
    color: 'var(--syntax-punctuation)',
    background: 'transparent',
  },
  'hljs-comment': {
    color: 'var(--syntax-comment)',
  },
  'hljs-string': {
    color: 'var(--syntax-string)',
  },
  'hljs-number': {
    color: 'var(--syntax-number)',
  },
  'hljs-literal': {
    color: 'var(--syntax-boolean)',
  },
  'hljs-attr': {
    color: 'var(--syntax-property)',
  },
  'hljs-property': {
    color: 'var(--syntax-property)',
  },
  'hljs-punctuation': {
    color: 'var(--syntax-punctuation)',
  },
  'hljs-operator': {
    color: 'var(--syntax-operator)',
  },
  // Add specific JSON key handling
  'hljs-keyword': {
    color: 'var(--syntax-property)',
  },
  // Make sure strings in JSON are properly colored
  '.hljs-string': {
    color: 'var(--syntax-string)',
  },
};

// Create a wrapper component for the syntax highlighter
const JsonHighlighter: React.FC<{ code: string }> = ({ code }) => {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      import('react-syntax-highlighter/dist/esm/light'),
      import('react-syntax-highlighter/dist/esm/languages/hljs/json')
    ]).then(([highlighter, jsonLang]) => {
      highlighter.default.registerLanguage('json', jsonLang.default);
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <pre style={{ 
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '12px',
        lineHeight: '16px'
      }}>
        {code}
      </pre>
    );
  }

  return (
    <React.Suspense fallback={
      <pre style={{ 
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '12px',
        lineHeight: '16px'
      }}>
        {code}
      </pre>
    }>
      <LazyHighlighter
        language="json"
        style={customTheme}
        customStyle={{
          fontSize: '12px',
          lineHeight: '16px',
          background: 'transparent',
        }}
      >
        {code}
      </LazyHighlighter>
    </React.Suspense>
  );
};

interface ExportPanelProps {
  onExport: () => void;
  isExporting: boolean;
  exportedData: CollectionExport[] | null;
  onDownload: () => void;
}

export function ExportPanel({
  onExport,
  isExporting,
  exportedData,
  onDownload,
}: ExportPanelProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!exportedData && !isExporting) {
      onExport();
    }
  }, [exportedData, isExporting, onExport]);

  const handleCopy = React.useCallback(async () => {
    if (!exportedData) return;
    
    try {
      // Request clipboard write permission
      const permissionResult = await navigator.permissions.query({
        name: 'clipboard-write' as PermissionName
      });
      
      if (permissionResult.state === 'denied') {
        throw new Error('Permission to write to clipboard was denied');
      }

      await navigator.clipboard.writeText(JSON.stringify(exportedData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      // Create a fallback copy mechanism
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(exportedData, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  }, [exportedData]);

  return (
    <div className="flex h-full w-full flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-medium text-figma-primary">Export</h2>
        <p className="text-xs text-figma-secondary">
          Export your variables for use in other Figma files.
        </p>
      </div>

      {isExporting ? (
        <div className="flex items-center gap-2 text-figma-secondary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-figma-blue border-t-transparent" />
          <span className="text-xs">Exporting...</span>
        </div>
      ) : exportedData && (
        <>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1.5 rounded-md bg-figma-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-figma-blue-hover"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>

            <button
              className="flex items-center gap-1.5 rounded-md border border-figma-border px-3 py-1.5 text-xs font-medium text-figma-primary hover:bg-black/5 dark:hover:bg-white/5"
              onClick={onDownload}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>

          <div className="relative flex flex-1 flex-col rounded-lg border border-figma-border bg-black/5 p-2 dark:bg-white/5">
            <div className="h-[236px] overflow-auto rounded bg-white p-2 text-xs dark:bg-[#2c2c2c]">
              <JsonHighlighter code={JSON.stringify(exportedData, null, 2)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
} 