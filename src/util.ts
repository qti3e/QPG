export function outdent(texts: TemplateStringsArray, ...args: any[]): string {
  let data: string = "";
  for (let i = 0; i < args.length; ++i) {
    data += texts[i] + args[i];
  }
  if (args.length) data += texts[args.length];

  const lines = data.split(/\r?\n/g);
  let minSpaces = Infinity;

  if (lines.length === 0) return "";

  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^\s*/)!;
    const len = match[0].length;
    if (len < minSpaces) minSpaces = len;
  }

  if (minSpaces === Infinity) minSpaces = 0;

  // Remove empty lines from the start and end of the data.
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  return lines.map(line => line.slice(minSpaces)).join("\n");
}
