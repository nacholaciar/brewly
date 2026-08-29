const HTML_SCRIPT_ESCAPES = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
} as const;

export function serializeJsonLd(value: Record<string, unknown>) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => HTML_SCRIPT_ESCAPES[character as keyof typeof HTML_SCRIPT_ESCAPES],
  );
}
