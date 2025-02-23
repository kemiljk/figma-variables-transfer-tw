import * as React from "react";
import { CollectionExport } from "../code";
import { Copy, Check, Download } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

// Custom theme with better light/dark mode contrast
const customTheme = {
  'pre[class*="language-"]': {
    background: 'transparent',
    margin: 0,
    padding: 0,
  },
  'code[class*="language-"]': {
    background: 'transparent',
  },
  'comment': {
    color: 'var(--syntax-comment)'
  },
  'string': {
    color: 'var(--syntax-string)'
  },
  'number': {
    color: 'var(--syntax-number)'
  },
  'constant': {
    color: 'var(--syntax-constant)'
  },
  'boolean': {
    color: 'var(--syntax-boolean)'
  },
  'property': {
    color: 'var(--syntax-property)'
  },
  'punctuation': {
    color: 'var(--syntax-punctuation)'
  },
  'operator': {
    color: 'var(--syntax-operator)'
  }
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
            <div className="h-[236px] overflow-auto rounded bg-figma p-2 text-xs">
              <SyntaxHighlighter
                language="json"
                style={customTheme}
                customStyle={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  background: 'transparent',
                }}
              >
                {JSON.stringify(exportedData, null, 2)}
              </SyntaxHighlighter>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 