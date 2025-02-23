import * as React from "react";
import { CollectionData } from "../types";
import { Clipboard, Upload, AlertCircle } from 'lucide-react';

interface ImportPanelProps {
  onImport: (data: string) => void;
}

export function ImportPanel({ onImport }: ImportPanelProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPasteArea, setShowPasteArea] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const processData = async (data: string) => {
    try {
      setIsProcessing(true);
      setError(null);
      const parsed = JSON.parse(data);
      
      // Validate the JSON structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error("Invalid JSON format: must be an object");
      }

      // Handle both array of collections or single collection
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          throw new Error("Collection array is empty");
        }
      }

      // If validation passes, send the data
      onImport(data);
    } catch (error) {
      console.error('Import error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process data');
    } finally {
      setIsProcessing(false);
    }
  };

  const processFile = async (file: File) => {
    const text = await file.text();
    await processData(text);
  };

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file?.type === "application/json" || file?.name.endsWith('.json')) {
      processFile(file);
    } else {
      setError("Please upload a JSON file");
    }
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handlePasteButtonClick = React.useCallback(() => {
    setShowPasteArea(prev => !prev);
  }, []);

  // Add global paste handler
  React.useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (isProcessing) return;
      
      try {
        const text = e.clipboardData?.getData('text');
        if (text) {
          e.preventDefault();
          await processData(text);
          // Clear the textarea for visual feedback
          if (textareaRef.current) {
            textareaRef.current.value = '';
          }
          setShowPasteArea(false);
        }
      } catch (error) {
        console.error('Global paste error:', error);
        setError(error instanceof Error ? error.message : 'Failed to paste data');
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isProcessing]);

  return (
    <div className="flex h-full w-full flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-medium text-figma-primary">Import</h2>
        <p className="text-xs text-figma-secondary">
          Import variables from a JSON file or paste directly from clipboard.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          className="flex items-center gap-1.5 rounded-md bg-figma-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-figma-blue-hover disabled:opacity-50"
          onClick={handlePasteButtonClick}
          disabled={isProcessing}
        >
          <Clipboard className="h-3.5 w-3.5" />
          {showPasteArea ? 'Cancel' : 'Paste'}
        </button>

        <div className="relative">
          <button
            className="flex items-center gap-1.5 rounded-md border border-figma-border px-3 py-1.5 text-xs font-medium text-figma-primary hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || showPasteArea}
          >
            <Upload className="h-3.5 w-3.5" />
            Choose File
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="application/json"
            onChange={handleFileSelect}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Simplify the conditional rendering */}
      <div className="relative h-[180px] w-full rounded-lg border border-dashed border-figma-border">
        {showPasteArea ? (
          <textarea
            ref={textareaRef}
            className="absolute inset-0 h-full w-full resize-none rounded-lg bg-figma p-3 text-xs text-figma-primary placeholder:text-figma-secondary focus:outline-none focus:ring-2 focus:ring-figma-blue focus:ring-offset-0 dark:text-figma-primary dark:placeholder:text-figma-secondary/50"
            placeholder="Paste your variables JSON here"
            autoFocus
            spellCheck={false}
            readOnly
          />
        ) : (
          <div 
            className="flex h-full w-full flex-col items-center justify-center"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <Upload className="h-8 w-8 text-figma-secondary" />
              <div className="flex flex-col gap-1">
                <p className="text-sm text-figma-primary">
                  Drag and drop your variables JSON file here
                </p>
                <p className="text-xs text-figma-secondary">
                  or use ⌃+V / ⌘+V to paste
                </p>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-black/50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-figma-blue border-t-transparent" />
            <p className="mt-3 text-sm text-figma-secondary">Processing...</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-2.5 text-xs text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="leading-tight">{error}</span>
        </div>
      )}
    </div>
  );
} 