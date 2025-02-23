figma.showUI(__html__, { themeColors: true, height: 548 });

console.clear();

function createCollection(name, modes) {
  // @ts-ignore
  const collection = figma.variables.createVariableCollection(name);
  // Rename the default mode
  collection.renameMode(collection.modes[0].modeId, modes[0]);
  // Add additional modes
  const modeIds = [collection.modes[0].modeId];
  for (let i = 1; i < modes.length; i++) {
    modeIds.push(collection.addMode(modes[i]));
  }
  return { collection, modeIds };
}

function createToken(collection, modeId, type, name, value) {
  // @ts-ignore
  const token = figma.variables.createVariable(name, collection.id, type);
  token.setValueForMode(modeId, value);
  return token;
}

function createVariable(collection, modeId, key, valueKey, tokens) {
  const token = tokens[valueKey];
  return createToken(collection, modeId, token.resolvedType, key, {
    type: "VARIABLE_ALIAS",
    id: `${token.id}`,
  });
}

function validateVariableType(type) {
  const validTypes = ["COLOR", "FLOAT", "STRING", "BOOLEAN"];
  if (!validTypes.includes(type)) {
    throw new Error(
      `Invalid variable type: ${type}. Must be one of: ${validTypes.join(", ")}`
    );
  }
}

function validateVariableScope(scope) {
  const validScopes = [
    "ALL_SCOPES",
    "TEXT_CONTENT",
    "CORNER_RADIUS",
    "WIDTH_HEIGHT",
    "GAP",
    "ROTATION",
    "OPACITY",
    "LAYOUT_GRID",
    "EFFECT",
    "PAINT",
  ];
  if (!validScopes.includes(scope)) {
    throw new Error(
      `Invalid variable scope: ${scope}. Must be one of: ${validScopes.join(
        ", "
      )}`
    );
  }
}

function importJSONFile({ fileName, body }) {
  console.log(`Importing file: ${fileName}`);
  let data;
  try {
    data = JSON.parse(body);
  } catch (error) {
    figma.notify("Invalid JSON format", { error: true });
    console.error("JSON parse error:", error);
    return;
  }

  if (!data.collections || !Array.isArray(data.collections)) {
    figma.notify("Invalid format: Missing collections array", { error: true });
    console.error("Invalid import format: missing collections array");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  data.collections.forEach((collectionData) => {
    try {
      if (!collectionData.name) {
        throw new Error("Collection name is required");
      }

      // Create the collection
      // @ts-ignore
      const collection = figma.variables.createVariableCollection(
        collectionData.name
      );

      // Validate modes
      if (!Array.isArray(collectionData.modes)) {
        throw new Error("Collection modes must be an array");
      }

      // Set up modes
      if (collectionData.modes.length > 0) {
        if (!collectionData.modes[0].name) {
          throw new Error("Mode name is required");
        }
        collection.renameMode(
          collection.modes[0].modeId,
          collectionData.modes[0].name
        );
      }

      for (let i = 1; i < collectionData.modes.length; i++) {
        if (!collectionData.modes[i].name) {
          throw new Error(`Invalid mode name at index ${i}`);
        }
        collection.addMode(collectionData.modes[i].name);
      }

      // Validate variables
      if (!Array.isArray(collectionData.variables)) {
        throw new Error("Collection variables must be an array");
      }

      // Create all variables first
      const variableMap = new Map();
      collectionData.variables.forEach((varData, index) => {
        try {
          if (!varData.name) {
            throw new Error(`Variable name is required at index ${index}`);
          }
          if (!varData.resolvedType) {
            throw new Error(`Variable type is required for ${varData.name}`);
          }

          validateVariableType(varData.resolvedType);

          // @ts-ignore
          const variable = figma.variables.createVariable(
            varData.name,
            collection.id,
            varData.resolvedType
          );

          if (varData.description) {
            variable.description = varData.description;
          }

          if (Array.isArray(varData.scopes)) {
            varData.scopes.forEach((scope) => validateVariableScope(scope));
            variable.scopes = varData.scopes;
          }

          variableMap.set(varData.id, variable);
        } catch (varError) {
          console.error(`Error creating variable ${varData.name}:`, varError);
          errorCount++;
          return;
        }
      });

      // Set values after all variables are created to handle aliases
      collectionData.variables.forEach((varData) => {
        const variable = variableMap.get(varData.id);
        if (!variable) return;

        try {
          Object.entries(varData.valuesByMode).forEach(([modeId, value]) => {
            if (!collection.modes.find((mode) => mode.modeId === modeId)) {
              throw new Error(`Invalid mode ID: ${modeId}`);
            }

            if (
              value &&
              typeof value === "object" &&
              "type" in value &&
              value.type === "VARIABLE_ALIAS" &&
              "id" in value
            ) {
              const referencedVariable = variableMap.get(value.id);
              if (!referencedVariable) {
                throw new Error(`Referenced variable not found: ${value.id}`);
              }
              variable.setValueForMode(modeId, {
                type: "VARIABLE_ALIAS",
                id: referencedVariable.id,
              });
            } else {
              // Type-specific validation
              switch (variable.resolvedType) {
                case "COLOR":
                  if (
                    !value ||
                    typeof value !== "object" ||
                    !("r" in value && "g" in value && "b" in value)
                  ) {
                    throw new Error(`Invalid color value for ${variable.name}`);
                  }
                  break;
                case "FLOAT":
                  if (typeof value !== "number" && typeof value !== "string") {
                    throw new Error(
                      `Invalid number value for ${variable.name}`
                    );
                  }
                  break;
                case "BOOLEAN":
                  if (
                    typeof value !== "boolean" &&
                    value !== "true" &&
                    value !== "false"
                  ) {
                    throw new Error(
                      `Invalid boolean value for ${variable.name}`
                    );
                  }
                  break;
              }
              variable.setValueForMode(modeId, value);
            }
          });
          successCount++;
        } catch (valueError) {
          console.error(
            `Error setting values for variable ${varData.name}:`,
            valueError
          );
          errorCount++;
        }
      });
    } catch (error) {
      console.error(
        `Error importing collection ${collectionData.name}:`,
        error
      );
      figma.notify(
        `Error in collection ${collectionData.name}: ${error.message}`,
        { error: true }
      );
      errorCount++;
    }
  });

  // Final status notification
  if (errorCount === 0) {
    figma.notify(`Successfully imported ${successCount} variables`);
  } else {
    figma.notify(
      `Imported ${successCount} variables with ${errorCount} errors`,
      { error: true }
    );
  }
}

function processAliases({ collection, modeId, aliases, tokens }) {
  aliases = Object.values(aliases);
  let generations = aliases.length;
  while (aliases.length && generations > 0) {
    for (let i = 0; i < aliases.length; i++) {
      const { key, valueKey } = aliases[i];
      const token = tokens[valueKey];
      if (token) {
        aliases.splice(i, 1);
        tokens[key] = createVariable(collection, modeId, key, valueKey, tokens);
      }
    }
    generations--;
  }
}

function isAlias(value) {
  return value.toString().trim().charAt(0) === "{";
}

function traverseToken({
  collection,
  modeId,
  type,
  key,
  object,
  tokens,
  aliases,
}) {
  type = type || object.$type;
  // if key is a meta field, move on
  if (key.charAt(0) === "$") {
    return;
  }
  if (object.$value !== undefined) {
    if (isAlias(object.$value)) {
      const valueKey = object.$value
        .trim()
        .replace(/\./g, "/")
        .replace(/[\{\}]/g, "");
      if (tokens[valueKey]) {
        tokens[key] = createVariable(collection, modeId, key, valueKey, tokens);
      } else {
        aliases[key] = {
          key,
          type,
          valueKey,
        };
      }
    } else {
      let resolvedType;
      let value = object.$value;

      switch (type) {
        case "color":
          resolvedType = "COLOR";
          value = parseColor(value);
          break;
        case "number":
          resolvedType = "FLOAT";
          value = typeof value === "number" ? value : parseFloat(value);
          break;
        case "string":
          resolvedType = "STRING";
          value = typeof value === "string" ? value : String(value);
          break;
        case "boolean":
          resolvedType = "BOOLEAN";
          value = typeof value === "boolean" ? value : value === "true";
          break;
        default:
          console.log("unsupported type", type, object);
          return;
      }

      tokens[key] = createToken(collection, modeId, resolvedType, key, value);
    }
  } else {
    Object.entries(object).forEach(([key2, object2]) => {
      if (key2.charAt(0) !== "$") {
        traverseToken({
          collection,
          modeId,
          type,
          key: `${key}/${key2}`,
          object: object2,
          tokens,
          aliases,
        });
      }
    });
  }
}

function exportToJSON() {
  // @ts-ignore
  const collections = figma.variables.getLocalVariableCollections();
  const exportData = {
    collections: collections.map((collection) => ({
      name: collection.name,
      modes: collection.modes.map((mode) => ({
        name: mode.name,
        modeId: mode.modeId,
      })),
      variables: processCollectionVariables(collection),
    })),
  };

  figma.ui.postMessage({ type: "EXPORT_RESULT", files: exportData });
}

function processCollectionVariables(collection) {
  const variables = [];

  collection.variableIds.forEach((variableId) => {
    // @ts-ignore
    const variable = figma.variables.getVariableById(variableId);
    if (!variable) return;

    const variableData = {
      id: variable.id,
      name: variable.name,
      resolvedType: variable.resolvedType,
      description: variable.description,
      scopes: variable.scopes,
      valuesByMode: {},
    };

    // Process values for each mode
    collection.modes.forEach((mode) => {
      const value = variable.valuesByMode[mode.modeId];
      if (value === undefined) return;

      if (
        value &&
        typeof value === "object" &&
        "type" in value &&
        value.type === "VARIABLE_ALIAS" &&
        "id" in value
      ) {
        variableData.valuesByMode[mode.modeId] = {
          type: "VARIABLE_ALIAS",
          id: value.id,
        };
      } else {
        switch (variable.resolvedType) {
          case "COLOR":
            variableData.valuesByMode[mode.modeId] = value;
            break;
          case "FLOAT":
            variableData.valuesByMode[mode.modeId] =
              typeof value === "number" ? value : parseFloat(String(value));
            break;
          case "STRING":
            variableData.valuesByMode[mode.modeId] =
              typeof value === "string" ? value : String(value);
            break;
          case "BOOLEAN":
            variableData.valuesByMode[mode.modeId] =
              typeof value === "boolean" ? value : value === "true";
            break;
        }
      }
    });

    variables.push(variableData);
  });

  return variables;
}

figma.ui.onmessage = (e) => {
  console.log("code received message", e);
  if (e.type === "IMPORT") {
    const { body } = e;
    console.log("importing", body);
    importJSONFile({ fileName: "variables.tokens.json", body });
    figma.notify("Imported tokens");
  } else if (e.type === "EXPORT") {
    console.log("exporting");
    exportToJSON();
    figma.notify("Exported tokens");
  } else if (e.type === "COPIED") {
    figma.notify("Copied to clipboard!");
  }
};

function rgbToHex({ r, g, b, a }) {
  if (a !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${a.toFixed(4)})`;
  }
  const toHex = (value) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}

function parseColor(color) {
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
    const [, r, g, b] = color.match(rgbRegex);
    return { r: parseInt(r) / 255, g: parseInt(g) / 255, b: parseInt(b) / 255 };
  } else if (rgbaRegex.test(color)) {
    const [, r, g, b, a] = color.match(rgbaRegex);
    return {
      r: parseInt(r) / 255,
      g: parseInt(g) / 255,
      b: parseInt(b) / 255,
      a: parseFloat(a),
    };
  } else if (hslRegex.test(color)) {
    const [, h, s, l] = color.match(hslRegex);
    return hslToRgbFloat(parseInt(h), parseInt(s) / 100, parseInt(l) / 100);
  } else if (hslaRegex.test(color)) {
    const [, h, s, l, a] = color.match(hslaRegex);
    return Object.assign(
      hslToRgbFloat(parseInt(h), parseInt(s) / 100, parseInt(l) / 100),
      { a: parseFloat(a) }
    );
  } else if (hexRegex.test(color)) {
    const hexValue = color.substring(1);
    const expandedHex =
      hexValue.length === 3
        ? hexValue
            .split("")
            .map((char) => char + char)
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

function hslToRgbFloat(h, s, l) {
  const hue2rgb = (p, q, t) => {
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
