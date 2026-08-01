import { unzipSync, strFromU8 } from "fflate";

export type AttachedFile = {
  url: string;
  mediaType?: string | undefined;
  filename?: string | undefined;
};

const TEXT_EXTENSIONS = [
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "yml",
  "yaml",
  "rtf",
  "log",
  "html",
  "htm",
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "sql",
];

const MAX_CHARS = 120_000;

function extension(filename?: string) {
  return (filename ?? "").split(".").pop()?.toLowerCase() ?? "";
}

function decodeBase64(url: string): Uint8Array {
  const base64 = url.includes(",") ? url.slice(url.indexOf(",") + 1) : url;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stripXml(xml: string) {
  return xml
    .replace(/<\/w:p>|<\/a:p>|<w:br\s*\/>/g, "\n")
    .replace(/<\/w:tc>|<\/a:tc>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function docxText(bytes: Uint8Array) {
  const zip = unzipSync(bytes);
  const doc = zip["word/document.xml"];
  if (!doc) return "";
  return stripXml(strFromU8(doc));
}

function pptxText(bytes: Uint8Array) {
  const zip = unzipSync(bytes);
  const slides = Object.keys(zip)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return slides
    .map((name, index) => {
      const texts = [...strFromU8(zip[name]!).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
        stripXml(m[1] ?? ""),
      );
      return `### Slide ${index + 1}\n${texts.filter(Boolean).join("\n")}`;
    })
    .join("\n\n")
    .trim();
}

function columnIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

function xlsxText(bytes: Uint8Array) {
  const zip = unzipSync(bytes);
  const shared = zip["xl/sharedStrings.xml"]
    ? [...strFromU8(zip["xl/sharedStrings.xml"]!).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        stripXml(m[1] ?? "").replace(/\n/g, " "),
      )
    : [];

  const sheets = Object.keys(zip)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return sheets
    .map((name, sheetIndex) => {
      const xml = strFromU8(zip[name]!);
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
        const cells: string[] = [];
        for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
          const attrs = cellMatch[1] ?? "";
          const body = cellMatch[2] ?? "";
          const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
          const isShared = /t="s"/.test(attrs);
          const raw = stripXml(/<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
          const value = isShared ? (shared[Number(raw)] ?? "") : raw;
          const at = ref ? columnIndex(ref) : cells.length;
          while (cells.length < at) cells.push("");
          cells[at] = value.replace(/\n/g, " ");
        }
        return cells.join(" | ");
      });
      const body = rows.filter((row) => row.replace(/[|\s]/g, "")).join("\n");
      return `### Sheet ${sheetIndex + 1}\n${body}`;
    })
    .join("\n\n")
    .trim();
}

/** Returns readable text for a non-image attachment, or null when the model can read it natively. */
export function extractFileText(file: AttachedFile): string | null {
  const ext = extension(file.filename);
  const mediaType = file.mediaType ?? "";

  try {
    if (mediaType.startsWith("text/") || TEXT_EXTENSIONS.includes(ext) || mediaType === "application/json") {
      return strFromU8(decodeBase64(file.url)).slice(0, MAX_CHARS);
    }
    if (ext === "docx" || mediaType.includes("wordprocessingml")) {
      return docxText(decodeBase64(file.url)).slice(0, MAX_CHARS);
    }
    if (ext === "xlsx" || ext === "xlsm" || mediaType.includes("spreadsheetml")) {
      return xlsxText(decodeBase64(file.url)).slice(0, MAX_CHARS);
    }
    if (ext === "pptx" || mediaType.includes("presentationml")) {
      return pptxText(decodeBase64(file.url)).slice(0, MAX_CHARS);
    }
    if (ext === "doc" || ext === "xls" || ext === "ppt") {
      return "[This is a legacy Microsoft Office binary file. Ask the user to re-save it as .docx, .xlsx, .pptx or PDF.]";
    }
  } catch (error) {
    console.error("[file-extract] failed", file.filename, error);
    return `[Could not read "${file.filename ?? "file"}". The file may be corrupted or password protected.]`;
  }

  return null;
}
