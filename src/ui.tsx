import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import { ExportPanel } from "./components/ExportPanel";
import { ImportPanel } from "./components/ImportPanel";
import { CollectionExport } from "./code";
import "./ui.css";

function App() {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportedData, setExportedData] = React.useState<CollectionExport[] | null>(null);

  // Handle messages from the plugin
  React.useEffect(() => {
    window.onmessage = ({ data: { pluginMessage } }) => {
      if (pluginMessage.type === "EXPORT_RESULT") {
        setExportedData(pluginMessage.data);
        setIsExporting(false);
      } else if (pluginMessage.type === "IMPORT_SUCCESS") {
        // Handle successful import
      } else if (pluginMessage.type === "IMPORT_ERROR") {
        // Handle import error
      }
    };
  }, []);

  const handleExport = () => {
    setIsExporting(true);
    parent.postMessage({ pluginMessage: { type: "EXPORT" } }, "*");
  };

  const handleDownload = () => {
    if (!exportedData) return;
    
    const blob = new Blob([JSON.stringify(exportedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'figma-variables.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (data: string) => {
    parent.postMessage({ pluginMessage: { type: "IMPORT", data } }, "*");
  };

  return (
    <main className="bg-bg-figma flex h-[100vh] w-full flex-col items-center justify-start">
      <Tabs.Root className="flex w-full flex-col" defaultValue="tab1">
        <Tabs.List className="mb-1 flex shrink-0 border-b border-neutral-300 dark:border-neutral-600">
          <Tabs.Trigger
            className="data-[state=active]:focus:none flex h-[45px] flex-1 cursor-default select-none items-center justify-center px-4 text-xs leading-none text-figma-secondary outline-none hover:text-figma-primary-hover data-[state=active]:font-semibold data-[state=active]:text-figma-primary dark:data-[state=active]:text-figma-primary"
            value="tab1"
          >
            <div className="relative flex h-full w-full items-center justify-center">
              Export
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger
            className="data-[state=active]:focus:none flex h-[45px] flex-1 cursor-default select-none items-center justify-center px-4 text-xs leading-none text-figma-secondary outline-none hover:text-figma-primary-hover data-[state=active]:font-semibold data-[state=active]:text-figma-primary dark:data-[state=active]:text-figma-primary"
            value="tab2"
          >
            Import
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content className="w-full flex-1" value="tab1">
          <ExportPanel
            onExport={handleExport}
            isExporting={isExporting}
            exportedData={exportedData}
            onDownload={handleDownload}
          />
        </Tabs.Content>

        <Tabs.Content className="w-full flex-1" value="tab2">
          <ImportPanel onImport={handleImport} />
        </Tabs.Content>
      </Tabs.Root>
    </main>
  );
}

const root = createRoot(document.getElementById("react-page")!);
root.render(<App />);
