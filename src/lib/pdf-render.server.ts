/** Renders simple markdown into a polished, print-quality PDF. */

type Align = "left" | "right" | "center";

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string; depth: number; marker: string }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "table"; head: string[]; rows: string[][]; aligns: Align[] };

/** pdf-lib standard fonts are WinAnsi-only, so replace common typographic characters. */
export function sanitize(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(\S[^*]*)\*/g, "$1$2")
    .replace(/`/g, "")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF\u2022]/g, "");
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isDivider(line: string) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
}

function parse(content: string): Block[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    // Markdown table: a pipe row followed by an alignment divider.
    if (line.includes("|") && isDivider(lines[i + 1] ?? "")) {
      flush();
      const head = splitRow(line);
      const aligns: Align[] = splitRow(lines[i + 1] ?? "").map((spec) => {
        if (spec.endsWith(":") && spec.startsWith(":")) return "center";
        if (spec.endsWith(":")) return "right";
        return "left";
      });
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && (lines[j] ?? "").includes("|") && (lines[j] ?? "").trim()) {
        if (isDivider(lines[j] ?? "")) {
          j += 1;
          continue;
        }
        const cells = splitRow(lines[j] ?? "");
        while (cells.length < head.length) cells.push("");
        rows.push(cells.slice(0, head.length));
        j += 1;
      }
      blocks.push({ kind: "table", head, rows, aligns });
      i = j - 1;
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flush();
      const hashes = line.match(/^#+/)?.[0].length ?? 1;
      const level = (hashes >= 3 ? 3 : hashes) as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, text: line.replace(/^#+\s*/, "") });
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }

    if (line.startsWith("> ")) {
      flush();
      blocks.push({ kind: "quote", text: line.slice(2) });
      continue;
    }

    const listMatch = line.match(/^([-*+]|\d+[.)])\s+(.*)$/);
    if (listMatch) {
      flush();
      const indent = (raw.match(/^\s*/)?.[0].length ?? 0) >= 2 ? 1 : 0;
      const bullet = listMatch[1] ?? "-";
      blocks.push({
        kind: "bullet",
        depth: indent,
        marker: /^\d/.test(bullet) ? `${bullet.replace(/[.)]$/, "")}.` : indent > 0 ? "\u2013" : "\u2022",
        text: listMatch[2] ?? "",
      });
      continue;
    }

    paragraph.push(line);
  }

  flush();
  return blocks;
}

export async function renderPdf(title: string, content: string, subtitle?: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("AozoraAi");
  pdf.setProducer("AozoraAi");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const width = 595.28;
  const height = 841.89;
  const margin = 60;
  const contentWidth = width - margin * 2;
  const footerSpace = 54;

  const ink = rgb(0.1, 0.12, 0.17);
  const soft = rgb(0.42, 0.46, 0.53);
  const accent = rgb(0.13, 0.44, 0.9);
  const hairline = rgb(0.84, 0.86, 0.9);
  const tint = rgb(0.95, 0.96, 0.98);

  type Page = ReturnType<typeof pdf.addPage>;
  let page: Page = pdf.addPage([width, height]);
  let cursor = height - margin;

  const bottom = margin + footerSpace;
  const newPage = () => {
    page = pdf.addPage([width, height]);
    cursor = height - margin;
  };
  const need = (space: number) => {
    if (cursor - space < bottom) newPage();
  };

  const wrap = (text: string, font: typeof regular, size: number, max: number) => {
    const lines: string[] = [];
    for (const chunk of sanitize(text).split("\n")) {
      let line = "";
      for (const word of chunk.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > max && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines.length > 0 ? lines : [""];
  };

  const drawText = (
    text: string,
    options: {
      size?: number;
      font?: typeof regular;
      color?: typeof ink;
      indent?: number;
      leadingRatio?: number;
      spaceBefore?: number;
      spaceAfter?: number;
    } = {},
  ) => {
    const size = options.size ?? 10.5;
    const font = options.font ?? regular;
    const indent = options.indent ?? 0;
    const leading = size * (options.leadingRatio ?? 1.5);
    cursor -= options.spaceBefore ?? 0;
    for (const line of wrap(text, font, size, contentWidth - indent)) {
      need(leading);
      page.drawText(line, {
        x: margin + indent,
        y: cursor - size,
        size,
        font,
        color: options.color ?? ink,
      });
      cursor -= leading;
    }
    cursor -= options.spaceAfter ?? 0;
  };

  // --- Cover header -------------------------------------------------------
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: accent });
  cursor -= 14;
  drawText(title, { size: 25, font: bold, leadingRatio: 1.2, spaceAfter: 10 });
  page.drawLine({
    start: { x: margin, y: cursor + 4 },
    end: { x: margin + 64, y: cursor + 4 },
    thickness: 2.5,
    color: accent,
  });
  cursor -= 14;
  const stamp = new Date().toLocaleDateString("en-US", { dateStyle: "long" });
  drawText(subtitle ? `${subtitle}  \u2022  ${stamp}` : stamp, {
    size: 9,
    color: soft,
    spaceAfter: 16,
  });

  // --- Body ---------------------------------------------------------------
  const drawTable = (block: Extract<Block, { kind: "table" }>) => {
    const cols = block.head.length;
    if (cols === 0) return;
    const size = 9;
    const padX = 7;
    const padY = 6;

    const natural = block.head.map((cell, index) => {
      const values = [cell, ...block.rows.map((row) => row[index] ?? "")];
      return Math.max(
        ...values.map((value) => bold.widthOfTextAtSize(sanitize(value), size) + padX * 2),
        44,
      );
    });
    const total = natural.reduce((sum, value) => sum + value, 0);
    const widths =
      total <= contentWidth
        ? natural.map((value) => value + (contentWidth - total) / cols)
        : natural.map((value) => Math.max(46, (value / total) * contentWidth));
    const scale = contentWidth / widths.reduce((sum, value) => sum + value, 0);
    const colWidths = widths.map((value) => value * scale);

    const xAt = (index: number) => margin + colWidths.slice(0, index).reduce((a, b) => a + b, 0);

    const drawRow = (cells: string[], isHead: boolean) => {
      const font = isHead ? bold : regular;
      const wrapped = cells.map((cell, index) =>
        wrap(cell, font, size, (colWidths[index] ?? 60) - padX * 2),
      );
      const rows = Math.max(...wrapped.map((lines) => lines.length));
      const rowHeight = rows * size * 1.35 + padY * 2;
      need(rowHeight + 4);
      const top = cursor;

      if (isHead) {
        page.drawRectangle({
          x: margin,
          y: top - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: tint,
        });
      }

      wrapped.forEach((lines, index) => {
        const cellWidth = colWidths[index] ?? 60;
        const align = block.aligns[index] ?? "left";
        lines.forEach((line, lineIndex) => {
          const textWidth = font.widthOfTextAtSize(line, size);
          const left = xAt(index) + padX;
          const x =
            align === "right"
              ? xAt(index) + cellWidth - padX - textWidth
              : align === "center"
                ? xAt(index) + (cellWidth - textWidth) / 2
                : left;
          page.drawText(line, {
            x,
            y: top - padY - size - lineIndex * size * 1.35,
            size,
            font,
            color: isHead ? ink : rgb(0.18, 0.21, 0.27),
          });
        });
      });

      page.drawLine({
        start: { x: margin, y: top - rowHeight },
        end: { x: margin + contentWidth, y: top - rowHeight },
        thickness: isHead ? 1 : 0.5,
        color: isHead ? accent : hairline,
      });
      cursor = top - rowHeight;
    };

    cursor -= 6;
    need(60);
    page.drawLine({
      start: { x: margin, y: cursor },
      end: { x: margin + contentWidth, y: cursor },
      thickness: 0.5,
      color: hairline,
    });
    drawRow(block.head, true);
    for (const row of block.rows) drawRow(row, false);
    cursor -= 12;
  };

  for (const block of parse(content)) {
    switch (block.kind) {
      case "heading": {
        if (block.level === 1) {
          need(50);
          cursor -= 12;
          drawText(block.text, { size: 16, font: bold, leadingRatio: 1.25, spaceAfter: 6 });
          page.drawLine({
            start: { x: margin, y: cursor + 4 },
            end: { x: margin + contentWidth, y: cursor + 4 },
            thickness: 0.75,
            color: hairline,
          });
          cursor -= 10;
        } else if (block.level === 2) {
          need(40);
          drawText(block.text, {
            size: 12.5,
            font: bold,
            leadingRatio: 1.3,
            spaceBefore: 12,
            spaceAfter: 4,
          });
        } else {
          need(34);
          drawText(block.text, {
            size: 10.5,
            font: bold,
            color: accent,
            leadingRatio: 1.3,
            spaceBefore: 9,
            spaceAfter: 2,
          });
        }
        break;
      }
      case "paragraph":
        drawText(block.text, { spaceAfter: 6 });
        break;
      case "bullet": {
        const indent = 14 + block.depth * 16;
        const markerWidth = bold.widthOfTextAtSize(block.marker, 10.5) + 6;
        need(16);
        page.drawText(sanitize(block.marker), {
          x: margin + indent,
          y: cursor - 10.5,
          size: 10.5,
          font: /\d/.test(block.marker) ? bold : regular,
          color: /\d/.test(block.marker) ? accent : soft,
        });
        drawText(block.text, { indent: indent + markerWidth, spaceAfter: 2 });
        break;
      }
      case "quote": {
        need(26);
        const top = cursor;
        drawText(block.text, { indent: 16, font: italic, color: soft, spaceAfter: 6 });
        page.drawRectangle({
          x: margin,
          y: cursor + 4,
          width: 2.5,
          height: top - cursor - 4,
          color: accent,
        });
        break;
      }
      case "rule":
        need(20);
        cursor -= 6;
        page.drawLine({
          start: { x: margin, y: cursor },
          end: { x: margin + contentWidth, y: cursor },
          thickness: 0.5,
          color: hairline,
        });
        cursor -= 12;
        break;
      case "table":
        drawTable(block);
        break;
    }
  }

  // --- Footers ------------------------------------------------------------
  const pages = pdf.getPages();
  const footerTitle = sanitize(title).slice(0, 70);
  pages.forEach((current, index) => {
    current.drawLine({
      start: { x: margin, y: margin + 26 },
      end: { x: width - margin, y: margin + 26 },
      thickness: 0.5,
      color: hairline,
    });
    current.drawText(footerTitle, {
      x: margin,
      y: margin + 12,
      size: 8,
      font: regular,
      color: soft,
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    current.drawText(label, {
      x: width - margin - regular.widthOfTextAtSize(label, 8),
      y: margin + 12,
      size: 8,
      font: regular,
      color: soft,
    });
  });

  return { bytes: await pdf.save(), pages: pages.length };
}
