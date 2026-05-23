import { countLines } from "@/lib/paste-as-file";

export interface ParsedDocumentAttachment {
  name: string;
  content: string;
  type: "document";
  sizeBytes: number;
  lineCount: number;
  truncated?: boolean;
}

export interface ParsedMessageFiles {
  visibleText: string;
  attachments: ParsedDocumentAttachment[];
}

function decodeAttr(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function byteSize(text: string) {
  return new TextEncoder().encode(text).length;
}

export function parseMessageFileBlocks(content: string): ParsedMessageFiles {
  const fallback = { visibleText: content, attachments: [] };
  if (!content || !content.includes("<file ")) return fallback;

  try {
    const attachments: ParsedDocumentAttachment[] = [];
    const consumed: Array<[number, number]> = [];
    const blockRegex = /^<file\s+([^>\n]+)>\n?([\s\S]*?)\n?<\/file>$/gm;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(content)) !== null) {
      const attrs = match[1] ?? "";
      const rawBody = match[2] ?? "";
      const nameMatch = attrs.match(/\bname=(["'])(.*?)\1/);
      if (!nameMatch?.[2]) continue;

      const name = decodeAttr(nameMatch[2]).trim();
      if (!name || name.length > 240) continue;

      const truncated = /\btruncated=(["'])true\1/.test(attrs);
      attachments.push({
        name,
        content: rawBody,
        type: "document",
        sizeBytes: byteSize(rawBody),
        lineCount: countLines(rawBody),
        truncated,
      });
      consumed.push([match.index, match.index + match[0].length]);
    }

    if (attachments.length === 0) return fallback;

    let visibleText = "";
    let cursor = 0;
    for (const [start, end] of consumed) {
      visibleText += content.slice(cursor, start);
      cursor = end;
    }
    visibleText += content.slice(cursor);

    return {
      visibleText: visibleText.replace(/\n{3,}/g, "\n\n").trim(),
      attachments,
    };
  } catch {
    return fallback;
  }
}
