import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

const ORANGE = "#f97316";
const BLACK = "#000000";
const DARK = "#222222";
const GRAY = "#888888";
const LIGHT_GRAY = "#e5e5e5";
const MARGIN = 60;

// Render inline **bold** segments. pdfkit has no inline rich text — we split manually.
function renderInline(doc: PDFKit.PDFDocument, text: string, baseFontSize: number, color: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const last = parts.length - 1;
  for (let i = 0; i <= last; i++) {
    const p = parts[i];
    const isBold = p.startsWith("**") && p.endsWith("**");
    const str = isBold ? p.slice(2, -2) : p;
    if (!str) continue;
    doc
      .font(isBold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(baseFontSize)
      .fillColor(color);
    doc.text(str, { continued: i < last, lineBreak: false });
  }
}

function parseMdToPdf(doc: PDFKit.PDFDocument, markdown: string) {
  const lines = markdown.split("\n");
  let i = 0;
  const pageW = doc.page.width;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    i++;

    if (t === "" || t === "[PRINTABLE]") {
      // blank line — small gap
      doc.moveDown(0.25);
      continue;
    }

    if (t === "---" || t === "***") {
      doc.moveDown(0.4);
      doc.moveTo(MARGIN, doc.y).lineTo(pageW - MARGIN, doc.y).strokeColor(LIGHT_GRAY).lineWidth(1).stroke();
      doc.moveDown(0.6);
      continue;
    }

    if (t.startsWith("### ")) {
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(GRAY).text(t.slice(4).toUpperCase(), { characterSpacing: 1 });
      doc.moveDown(0.2);
      continue;
    }

    if (t.startsWith("## ")) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(ORANGE).text(t.slice(3).toUpperCase(), { characterSpacing: 1.5 });
      doc.moveDown(0.25);
      continue;
    }

    if (t.startsWith("# ")) {
      doc.moveDown(0.8);
      // Orange left-border accent
      const barH = 22;
      doc.rect(MARGIN, doc.y, 4, barH).fill(ORANGE);
      doc.font("Helvetica-Bold").fontSize(16).fillColor(BLACK).text(t.slice(2), MARGIN + 12, doc.y - barH + 4);
      doc.moveDown(0.4);
      continue;
    }

    if (/^[*-] /.test(t)) {
      const item = t.slice(2);
      const x = doc.x;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(ORANGE).text("—", x, doc.y, { continued: true, lineBreak: false });
      doc.text(" ", { continued: true, lineBreak: false });
      renderInline(doc, item, 11, DARK);
      doc.moveDown(0.15);
      continue;
    }

    // Regular paragraph
    renderInline(doc, t, 11, DARK);
    doc.moveDown(0.35);
  }
}

export async function POST(req: NextRequest) {
  let content = "";
  let title = "MEDIA PRESS KIT";
  try {
    const body = await req.json() as { content?: string; title?: string };
    content = body.content ?? "";
    title = body.title ?? title;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateSlug = new Date().toISOString().slice(0, 10);

  const doc = new PDFDocument({ margin: MARGIN, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 6).fill(ORANGE);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(7).fillColor(ORANGE)
    .text("SUPERFLUIDO · BUNKER OPERATING SYSTEM", { characterSpacing: 2 });
  doc.moveDown(0.2);

  doc.font("Helvetica-Bold").fontSize(30).fillColor(BLACK).text(title);
  doc.moveDown(0.15);

  doc.font("Helvetica").fontSize(9).fillColor(GRAY)
    .text(`Roma, ${today}  ·  @superfluido_official`, { align: "right" });
  doc.moveDown(0.4);

  doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y)
    .strokeColor(LIGHT_GRAY).lineWidth(1).stroke();
  doc.moveDown(1);

  // ── Content ──────────────────────────────────────────────────────────────────
  parseMdToPdf(doc, content);

  // ── Footer on every page ────────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    const footerY = doc.page.height - 36;
    doc.moveTo(MARGIN, footerY - 6).lineTo(doc.page.width - MARGIN, footerY - 6)
      .strokeColor(ORANGE).lineWidth(2).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(GRAY)
      .text(
        `SUPERFLUIDO — Hip-Hop Indipendente · Roma 2021    |    Generato il ${today}`,
        MARGIN, footerY, { align: "center", width: doc.page.width - MARGIN * 2 },
      );
  }

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="press-kit-superfluido-${dateSlug}.pdf"`,
    },
  });
}
