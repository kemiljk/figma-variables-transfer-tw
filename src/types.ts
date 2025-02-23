export type CollectionData = {
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