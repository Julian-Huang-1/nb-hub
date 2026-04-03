export type ParsedAnkiLine = {
  deckName: string;
  front: string;
  back: string;
  tags: string[];
};

const splitTags = (raw: string) =>
  raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Anki plain text: optional `#deck:Name` (applies to following lines), then tab-separated rows.
 * - Two columns: `front\tback`
 * - Three or more: `front\t...\t tags` — middle columns form `back` (joined with newlines), last column is space-separated tags.
 */
export function parseAnkiPlainText(text: string): ParsedAnkiLine[] {
  let currentDeck = "Default";
  const lines: ParsedAnkiLine[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) continue;

    if (line.startsWith("#deck:")) {
      const name = line.slice("#deck:".length).trim();
      if (name) currentDeck = name;
      continue;
    }
    if (line.startsWith("#")) continue;

    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const front = parts[0] ?? "";
    let back: string;
    let tags: string[] = [];

    if (parts.length === 2) {
      back = parts[1] ?? "";
    } else {
      const last = parts[parts.length - 1] ?? "";
      tags = splitTags(last);
      back = parts.slice(1, -1).join("\n");
    }

    if (!front.trim() && !back.trim()) continue;
    lines.push({ deckName: currentDeck, front, back, tags });
  }

  return lines;
}
