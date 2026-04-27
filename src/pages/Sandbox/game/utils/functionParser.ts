export function getParamNames(func: Function): string[] {
  const str = func.toString()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const functionMatch = str.match(/^(?:async\s+)?function\s*\w*\s*\(([^)]*)\)/);
  if (functionMatch) return parseParamString(functionMatch[1]);

  const arrowMatch = str.match(/^(?:async\s*)?\(([^)]*)\)\s*=>/);
  if (arrowMatch) return parseParamString(arrowMatch[1]);

  const singleParamMatch = str.match(/^(?:async\s*)?(\w+)\s*=>/);
  if (singleParamMatch) return [singleParamMatch[1]];

  const methodMatch = str.match(/^(?:async\s+)?\w+\s*\(([^)]*)\)/);
  if (methodMatch) return parseParamString(methodMatch[1]);

  return [];
}

function parseParamString(paramString: string): string[] {
  return paramString
    .split(',')
    .map(param => param.trim().replace(/^\.\.\./, '').split('=')[0].trim())
    .filter(param => /^\w+$/.test(param));
}

export function getRuntimeType(param: string): string {
  return param.split('_')[1] || 'unknown';
}

export function getParamDefaults(func: Function): Record<string, string | number | boolean> {
  const str = func.toString()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const functionMatch = str.match(/^(?:async\s+)?function\s*\w*\s*\(([^)]*)\)/);
  const methodMatch   = str.match(/^(?:async\s+)?\w+\s*\(([^)]*)\)/);
  const paramString   = functionMatch?.[1]
    ?? str.match(/^(?:async\s*)?\(([^)]*)\)\s*=>/)?.[1]
    ?? methodMatch?.[1];
  if (!paramString) return {};

  const result: Record<string, string | number | boolean> = {};
  for (const segment of paramString.split(',')) {
    const eqIndex = segment.indexOf('=');
    if (eqIndex === -1) continue;
    const name = segment.slice(0, eqIndex).trim().replace(/^\.\.\./, '');
    const raw  = segment.slice(eqIndex + 1).trim();
    if (raw === 'true')                        result[name] = true;
    else if (raw === 'false')                  result[name] = false;
    else if (/^-?\d+(\.\d+)?$/.test(raw))     result[name] = parseFloat(raw);
    else if (/^["'].*["']$/.test(raw))         result[name] = raw.slice(1, -1);
  }
  return result;
}