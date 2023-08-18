import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import * as Label from "@radix-ui/react-label";
import "./ui.css";

function App() {
  const [inputValue, setInputValue] = React.useState("");
  const [isDisabled, setIsDisabled] = React.useState(true);

  window.onmessage = ({ data: { pluginMessage } }) => {
    if (pluginMessage.type === "EXPORT_RESULT") {
      document.querySelector("textarea").innerHTML = pluginMessage.files
        .map(
          ({ fileName, body }) =>
            `/* ${fileName} */\n\n${JSON.stringify(body, null, 2)}`
        )
        .join("\n\n\n");
    }
    setIsDisabled(false);
  };

  const handleExport = () => {
    parent.postMessage({ pluginMessage: { type: "EXPORT" } }, "*");
  };

  const handleCopy = () => {
    const textarea: HTMLTextAreaElement = document.querySelector(
      "#exported-variables"
    );
    textarea.select();
    document.execCommand("copy");
    parent.postMessage({ pluginMessage: { type: "COPIED" } }, "*");
  };

  const handleImport = (e: React.FormEvent<HTMLFormElement>) => {
    const fileName = document.querySelector("input").value.trim();
    const body = document.querySelector("textarea").value.trim();
    e.preventDefault();
    if (isValidJSON(body) && fileName) {
      parent.postMessage(
        { pluginMessage: { fileName, body, type: "IMPORT" } },
        "*"
      );
    } else {
      alert("Invalid filename or JSON");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  function isValidJSON(body: string) {
    try {
      JSON.parse(body);
      return true;
    } catch (e) {
      return false;
    }
  }

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
        <Tabs.Content className="w-full p-4" value="tab1">
          <div className="flex flex-col gap-4">
            <button
              id="export"
              type="button"
              className="w-full rounded-md bg-figma-blue px-3 py-2 text-xs text-figma-onBrand hover:bg-figma-blue-hover"
              onClick={() => handleExport()}
            >
              Generate Variables
            </button>
            <div className="relative">
              <button
                id="copy"
                type="button"
                className="absolute bottom-2 left-2 rounded-md bg-figma-secondaryBg px-3 py-2 text-xs text-figma-primary hover:bg-figma-secondaryBg-hover disabled:cursor-not-allowed disabled:resize-none disabled:border-0 disabled:bg-figma-secondaryBg disabled:opacity-50"
                onClick={() => handleCopy()}
                disabled={isDisabled}
              >
                Copy
              </button>
              <textarea
                placeholder="Exported variables will appear here..."
                readOnly
                id="exported-variables"
                className="h-[75vh] min-h-[100px] w-full whitespace-pre-wrap rounded-md border border-figma-border bg-transparent p-3 font-mono text-sm font-normal text-figma-primary outline outline-0 transition-all placeholder-shown:border placeholder-shown:border-figma-border disabled:cursor-not-allowed disabled:resize-none disabled:border-0 disabled:bg-figma-secondaryBg disabled:opacity-50"
              />
            </div>
          </div>
        </Tabs.Content>
        <Tabs.Content className="w-full p-4" value="tab2">
          <div className="flex h-full w-full flex-col items-center justify-between">
            <form
              className="flex h-full w-full flex-col space-y-4"
              onSubmit={handleImport}
            >
              <div className="relative flex flex-wrap items-center gap-2">
                <Label.Root
                  className="text-xs font-medium text-figma-primary"
                  htmlFor="IMPORT_INPUT"
                >
                  Collection Name
                </Label.Root>
                <input
                  id="IMPORT_INPUT"
                  placeholder="Collection Name"
                  required
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  className="inline-flex h-8 w-full appearance-none items-center justify-center rounded-md bg-figma-secondaryBg px-3 text-xs leading-none text-figma-primary outline-none focus:outline-blue-700 disabled:cursor-not-allowed disabled:text-figma-secondary dark:focus:outline-figma-blue"
                />
              </div>
              <textarea
                required
                placeholder="Tokens JSON"
                className="min-h-[60vh] w-full whitespace-pre-wrap rounded-md border border-figma-border bg-transparent p-3 font-mono text-sm font-normal text-figma-primary outline outline-0 transition-all placeholder-shown:border placeholder-shown:border-figma-border focus:border focus:border-figma-brand focus:outline-0 disabled:cursor-not-allowed disabled:resize-none disabled:border-0 disabled:bg-figma-secondaryBg disabled:opacity-50"
                defaultValue={""}
              />
              <button
                type="submit"
                className="mb-0 w-full rounded-md bg-figma-blue px-3 py-2 text-xs text-figma-onBrand hover:bg-figma-blue-hover"
              >
                Import Variables
              </button>
            </form>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </main>
  );
}

const root = createRoot(document.getElementById("react-page")!);
root.render(<App />);
