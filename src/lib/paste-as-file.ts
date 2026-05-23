import type { ClipboardEvent } from "react";

export const LONG_PASTE_CHAR_THRESHOLD = 1500;
export const LONG_PASTE_LINE_THRESHOLD = 15;

export interface TextAttachment {
  name: string;
  size: number;
  content: string;
  truncated?: boolean;
  mime?: string;
  lineCount?: number;
}

export interface PasteAsFileOptions<TAttachment = TextAttachment> {
  thresholdChars?: number;
  thresholdNewlines?: number;
  existingNames?: string[];
  uploadTextFile: (file: File) => Promise<TAttachment>;
  onAttach: (attachment: TAttachment, meta: { lines: number; sizeBytes: number }) => void;
  onError?: (error: unknown) => void;
}

export function countLines(text: string) {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

export function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function makePastedTextName(existingNames: string[] = []) {
  const used = new Set(existingNames);
  let index = 0;
  while (true) {
    const name = index === 0 ? "Pasted text.txt" : `Pasted text(${index}).txt`;
    if (!used.has(name)) return name;
    index += 1;
  }
}

export async function handlePasteAsFile<TAttachment = TextAttachment>(
  event: ClipboardEvent<HTMLTextAreaElement>,
  options: PasteAsFileOptions<TAttachment>
) {
  const text = event.clipboardData.getData("text/plain");
  if (!text) return false;

  const lines = countLines(text);
  const alwaysPasteAsFile =
    typeof window !== "undefined" && window.localStorage.getItem("surya:always-paste-as-file") === "1";
  const thresholdChars = options.thresholdChars ?? LONG_PASTE_CHAR_THRESHOLD;
  const thresholdNewlines = options.thresholdNewlines ?? LONG_PASTE_LINE_THRESHOLD;
  const shouldAttach = alwaysPasteAsFile || text.length > thresholdChars || lines > thresholdNewlines;
  if (!shouldAttach) return false;

  event.preventDefault();
  const name = makePastedTextName(options.existingNames);
  const file = new File([text], name, { type: "text/plain;charset=utf-8" });

  try {
    const attachment = await options.uploadTextFile(file);
    options.onAttach(attachment, { lines, sizeBytes: file.size });
  } catch (error) {
    options.onError?.(error);
  }

  return true;
}

export async function handleLongPaste(
  event: ClipboardEvent<HTMLTextAreaElement>,
  threshold: number,
  onAttach: (file: File, meta: { lines: number }) => Promise<void> | void
) {
  return handlePasteAsFile(event, {
    thresholdChars: threshold,
    uploadTextFile: async (file) => file,
    onAttach: (file, meta) => onAttach(file, { lines: meta.lines }),
  });
}
