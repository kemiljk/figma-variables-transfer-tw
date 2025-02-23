/// <reference types="@figma/plugin-typings" />

// Export types for UI
export type CollectionExport = {
  name: string;
  modes: { name: string; modeId: string }[];
  variables: {
    id: string;
    name: string;
    resolvedType: VariableResolvedDataType;
    description?: string;
    scopes: VariableScope[];
    valuesByMode: Record<string, VariableValue>;
  }[];
};

figma.showUI(__html__, { 
  themeColors: true, 
  height: 440
});

console.clear();

function validateVariableScope(scope: string): scope is VariableScope {
  const validScopes = [
    "ALL_SCOPES",
    "TEXT_CONTENT",
    "CORNER_RADIUS",
    "WIDTH_HEIGHT",
    "GAP",
    "ROTATION",
    "OPACITY",
    "STROKE_WEIGHT",
    "STROKE_COLOR",
    "STROKE_OPACITY",
    "BACKGROUND_COLOR",
    "BACKGROUND_OPACITY",
    "EFFECT",
    "LAYOUT_GRID"
  ];
  return validScopes.includes(scope);
}

async function importCollection(collection: CollectionExport): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Importing collection:', collection.name);
    console.log('Modes:', collection.modes);
    
    // Create the collection
    const figmaCollection = figma.variables.createVariableCollection(collection.name);
    
    // Set up modes - first rename the default mode, then add additional modes
    const modeMap = new Map<string, string>();
    
    // Rename the default mode to match the first mode in our collection
    if (collection.modes.length > 0) {
      const firstMode = collection.modes[0];
      console.log('First mode:', firstMode);
      figmaCollection.renameMode(figmaCollection.modes[0].modeId, firstMode.name);
      modeMap.set(firstMode.modeId, figmaCollection.modes[0].modeId);
      console.log('Mode mapping for first mode:', firstMode.modeId, '->', figmaCollection.modes[0].modeId);
      
      // Add additional modes and store the mapping between imported modeIds and new modeIds
      for (let i = 1; i < collection.modes.length; i++) {
        const mode = collection.modes[i];
        const newModeId = figmaCollection.addMode(mode.name);
        modeMap.set(mode.modeId, newModeId);
        console.log('Mode mapping:', mode.modeId, '->', newModeId);
      }
    }

    // Create variables and store their references
    const variableMap = new Map<string, Variable>();
    
    // First pass: Create all variables
    for (const varData of collection.variables) {
      try {
        console.log('Creating variable:', varData.name, 'type:', varData.resolvedType);
        const variable = figma.variables.createVariable(
          varData.name,
          figmaCollection.id,
          varData.resolvedType
        );

        if (varData.description) {
          variable.description = varData.description;
        }

        if (Array.isArray(varData.scopes)) {
          const validScopes = varData.scopes.filter(validateVariableScope);
          if (validScopes.length) {
            variable.scopes = validScopes;
          }
        }

        variableMap.set(varData.id, variable);
      } catch (error) {
        console.error(`Error creating variable ${varData.name}:`, error);
        throw error;
      }
    }

    // Second pass: Set values and handle aliases
    for (const varData of collection.variables) {
      const variable = variableMap.get(varData.id);
      if (!variable) continue;

      try {
        console.log('Setting values for variable:', varData.name);
        console.log('Values by mode:', varData.valuesByMode);
        
        // For each mode in the variable's valuesByMode
        for (const [importedModeId, value] of Object.entries(varData.valuesByMode)) {
          // Get the corresponding new modeId
          const newModeId = modeMap.get(importedModeId);
          console.log('Setting value for mode:', importedModeId, '->', newModeId, 'value:', value);
          
          if (!newModeId) {
            console.warn('No matching mode ID found for:', importedModeId);
            continue;
          }

          // If the value is a variable alias, update the reference
          if (value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
            const referencedVariable = variableMap.get(value.id);
            if (referencedVariable) {
              console.log('Setting alias reference:', value.id, '->', referencedVariable.id);
              variable.setValueForMode(newModeId, {
                type: 'VARIABLE_ALIAS',
                id: referencedVariable.id
              });
            } else {
              console.warn('Referenced variable not found:', value.id);
            }
          } else {
            // For direct values (not aliases)
            console.log('Setting direct value:', value);
            variable.setValueForMode(newModeId, value);
          }
        }
      } catch (error) {
        console.error(`Error setting values for variable ${varData.name}:`, error);
        throw error;
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function importJSONFile(data: string): Promise<void> {
  try {
    const parsed = JSON.parse(data);
    
    // Validate overall structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error("Invalid JSON format: must be an object");
    }

    // Handle both single collection and collections array
    const collections: CollectionExport[] = Array.isArray(parsed) 
      ? parsed 
      : [parsed];

    if (!collections.length) {
      throw new Error("No collections found in JSON");
    }

    // Import each collection
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const collection of collections) {
      const result = await importCollection(collection);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        if (result.error) {
          errors.push(`Error in collection ${collection.name}: ${result.error}`);
        }
      }
    }

    // Send result to UI
    if (errorCount === 0) {
      figma.notify(`Successfully imported ${successCount} collection(s)`);
      figma.ui.postMessage({ type: "IMPORT_SUCCESS", count: successCount });
    } else {
      const message = `Imported ${successCount} collection(s) with ${errorCount} error(s)`;
      figma.notify(message, { error: true });
      figma.ui.postMessage({ 
        type: "IMPORT_ERROR",
        message,
        errors
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Failed to import variables';
    figma.notify(message, { error: true });
    figma.ui.postMessage({ 
      type: "IMPORT_ERROR",
      message,
      errors: [message]
    });
  }
}

async function exportToJSON(): Promise<void> {
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const exportData: CollectionExport[] = collections.map((collection: VariableCollection) => {
      const variables = collection.variableIds
        .map((id: string) => {
          const variable = figma.variables.getVariableById(id);
          if (!variable) return null;

          return {
            id: variable.id,
            name: variable.name,
            resolvedType: variable.resolvedType,
            description: variable.description || undefined,
            scopes: variable.scopes,
            valuesByMode: collection.modes.reduce((acc: Record<string, VariableValue>, mode: { name: string; modeId: string; }) => {
              const value = variable.valuesByMode[mode.modeId];
              if (value !== undefined) {
                acc[mode.modeId] = value;
              }
              return acc;
            }, {} as Record<string, VariableValue>)
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      return {
        name: collection.name,
        modes: collection.modes.map((mode: { name: string; modeId: string; }) => ({
          name: mode.name,
          modeId: mode.modeId
        })),
        variables
      };
    });

    figma.ui.postMessage({ type: "EXPORT_RESULT", data: exportData });
  } catch (error) {
    console.error('Export error:', error);
    const message = error instanceof Error ? error.message : 'Failed to export variables';
    figma.notify(message, { error: true });
    figma.ui.postMessage({ 
      type: "EXPORT_ERROR",
      message,
    });
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'IMPORT') {
    await importJSONFile(msg.data);
  } else if (msg.type === 'EXPORT') {
    await exportToJSON();
  }
};

function rgbToHex({ r, g, b, a }: { r: number; g: number; b: number; a?: number }): string {
  if (typeof a !== 'undefined' && a !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${typeof a === 'number' ? a.toFixed(4) : "1"})`;
  }
  const toHex = (value: number): string => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}

function parseColor(color: string): { r: number; g: number; b: number; a?: number } {
  color = color.trim();
  const rgbRegex = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
  const rgbaRegex =
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)$/;
  const hslRegex = /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/;
  const hslaRegex =
    /^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*([\d.]+)\s*\)$/;
  const hexRegex = /^#([A-Fa-f0-9]{3}){1,2}$/;
  const floatRgbRegex =
    /^\{\s*r:\s*[\d\.]+,\s*g:\s*[\d\.]+,\s*b:\s*[\d\.]+(,\s*opacity:\s*[\d\.]+)?\s*\}$/;

  if (rgbRegex.test(color)) {
    const [, r, g, b] = color.match(rgbRegex)!;
    return { r: parseInt(r) / 255, g: parseInt(g) / 255, b: parseInt(b) / 255 };
  } else if (rgbaRegex.test(color)) {
    const [, r, g, b, a] = color.match(rgbaRegex)!;
    return {
      r: parseInt(r) / 255,
      g: parseInt(g) / 255,
      b: parseInt(b) / 255,
      a: parseFloat(a),
    };
  } else if (hslRegex.test(color)) {
    const [, h, s, l] = color.match(hslRegex)!;
    return hslToRgbFloat(parseInt(h), parseInt(s) / 100, parseInt(l) / 100);
  } else if (hslaRegex.test(color)) {
    const [, h, s, l, a] = color.match(hslaRegex)!;
    return {
      ...hslToRgbFloat(parseInt(h), parseInt(s) / 100, parseInt(l) / 100),
      a: parseFloat(a),
    };
  } else if (hexRegex.test(color)) {
    const hexValue = color.substring(1);
    const expandedHex =
      hexValue.length === 3
        ? hexValue
            .split("")
            .map((char: string) => char + char)
            .join("")
        : hexValue;
    return {
      r: parseInt(expandedHex.slice(0, 2), 16) / 255,
      g: parseInt(expandedHex.slice(2, 4), 16) / 255,
      b: parseInt(expandedHex.slice(4, 6), 16) / 255,
    };
  } else if (floatRgbRegex.test(color)) {
    return JSON.parse(color);
  } else {
    throw new Error("Invalid color format");
  }
}

function hslToRgbFloat(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  if (s === 0) {
    return { r: l, g: l, b: l };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, (h + 1 / 3) % 1);
  const g = hue2rgb(p, q, h % 1);
  const b = hue2rgb(p, q, (h - 1 / 3) % 1);

  return { r, g, b };
}
