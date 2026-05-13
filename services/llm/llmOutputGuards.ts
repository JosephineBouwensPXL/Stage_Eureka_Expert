const SENSITIVE_OUTPUT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|xox[baprs]-[0-9A-Za-z-]{20,})\b/g, '[geheim verwijderd]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[token verwijderd]'],
  [/\b(?:password|wachtwoord|secret|api[_-]?key|token)\s*[:=]\s*['"]?[^'",\s]{6,}/gi, '[geheim verwijderd]'],
];

export function sanitizeLlmVisibleOutput(input: string): string {
  let output = input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<\/?(?:script|iframe|object|embed|style|link|meta)[^>]*>/gi, '')
    .replace(/\b(?:system prompt|systeemprompt|developer message|hidden instruction)s?\s*[:=][\s\S]*$/gi, '');

  for (const [pattern, replacement] of SENSITIVE_OUTPUT_PATTERNS) {
    output = output.replace(pattern, replacement);
  }

  return output;
}
