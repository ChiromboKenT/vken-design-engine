export interface ExtractedTokens {
  colors: Record<string, string>;
  spacings: Record<string, string>;
  radii: Record<string, string>;
  coverageRatio: number;
}

const CSS_VAR_RE = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;}{]+)\s*;/g;
const VAR_USAGE_RE = /var\(\s*--[a-zA-Z0-9-_]+\s*\)/g;
const DECL_RE = /[a-zA-Z-]+\s*:\s*[^;}{]+;/g;

export function extractCssTokens(css: string): ExtractedTokens {
  const colors: Record<string, string> = {};
  const spacings: Record<string, string> = {};
  const radii: Record<string, string> = {};

  let match: RegExpExecArray | null;
  CSS_VAR_RE.lastIndex = 0;
  while ((match = CSS_VAR_RE.exec(css))) {
    const name = match[1] ?? '';
    const value = (match[2] ?? '').trim();
    if (isColorToken(name, value)) colors[name] = value;
    else if (isRadiusToken(name)) radii[name] = value;
    else if (isSpacingToken(name, value)) spacings[name] = value;
  }

  const declarations = css.match(DECL_RE) ?? [];
  const tokenized = declarations.filter((decl) => {
    VAR_USAGE_RE.lastIndex = 0;
    return VAR_USAGE_RE.test(decl);
  }).length;
  return {
    colors,
    spacings,
    radii,
    coverageRatio: declarations.length === 0 ? 1 : tokenized / declarations.length,
  };
}

function isColorToken(name: string, value: string): boolean {
  return /color|background|foreground|accent|surface|border/i.test(name) || /^#|rgb|hsl|oklch/.test(value);
}

function isRadiusToken(name: string): boolean {
  return /radius|rounded/i.test(name);
}

function isSpacingToken(name: string, value: string): boolean {
  return /space|spacing|gap|padding|margin/i.test(name) || /\b\d+(?:\.\d+)?(?:px|rem|em)\b/.test(value);
}
