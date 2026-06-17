import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

const ORANGE = "#f97316";
const BLACK = "#000000";
const DARK = "#222222";
const GRAY = "#888888";
const LIGHT_GRAY = "#e5e5e5";
const MARGIN = 56;

type Doc = PDFKit.PDFDocument;

function renderInline(doc: Doc, text: string, size: number, color: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const last = parts.length - 1;
  for (let i = 0; i <= last; i++) {
    const p = parts[i];
    const bold = p.startsWith("**") && p.endsWith("**");
    const str = bold ? p.slice(2, -2) : p;
    if (!str) continue;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
    doc.text(str, { continued: i < last, lineBreak: false });
  }
}

function parseMdToPdf(doc: Doc, markdown: string) {
  const pageW = doc.page.width;
  const contentW = pageW - MARGIN * 2;

  for (const raw of markdown.split("\n")) {
    const t = raw.trim();

    if (t === "" || t === "[PRINTABLE]") {
      doc.moveDown(0.2);
      continue;
    }
    if (t === "---" || t === "***") {
      doc.moveDown(0.3);
      doc.moveTo(MARGIN, doc.y).lineTo(pageW - MARGIN, doc.y)
        .strokeColor(LIGHT_GRAY).lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      continue;
    }
    if (t.startsWith("### ")) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(GRAY)
        .text(t.slice(4).toUpperCase(), MARGIN, doc.y, { width: contentW, characterSpacing: 1 });
      doc.moveDown(0.2);
      continue;
    }
    if (t.startsWith("## ")) {
      doc.moveDown(0.7);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(ORANGE)
        .text(t.slice(3).toUpperCase(), MARGIN, doc.y, { width: contentW, characterSpacing: 1.5 });
      doc.moveDown(0.25);
      continue;
    }
    if (t.startsWith("# ")) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(17).fillColor(BLACK)
        .text(t.slice(2), MARGIN, doc.y, { width: contentW });
      doc.moveDown(0.3);
      continue;
    }
    if (/^[*-] /.test(t)) {
      const item = t.slice(2);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(ORANGE)
        .text("— ", MARGIN, doc.y, { continued: true, lineBreak: false });
      renderInline(doc, item, 10.5, DARK);
      doc.moveDown(0.1);
      continue;
    }
    // paragraph
    renderInline(doc, t, 11, DARK);
    doc.moveDown(0.3);
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

  const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageW = doc.page.width;
  const contentW = pageW - MARGIN * 2;

  // ── Orange accent bar at top ─────────────────────────────────────────────────
  doc.rect(0, 0, pageW, 5).fill(ORANGE);
  // reset cursor to after margin
  doc.x = MARGIN;
  doc.y = MARGIN + 10;

  // ── Branding line ────────────────────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(7).fillColor(ORANGE)
    .text("SUPERFLUIDO · BUNKER OPERATING SYSTEM", MARGIN, doc.y, { width: contentW, characterSpacing: 2 });
  doc.moveDown(0.4);

  // ── Title ────────────────────────────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(28).fillColor(BLACK)
    .text(title, MARGIN, doc.y, { width: contentW });
  doc.moveDown(0.3);

  // ── Date ─────────────────────────────────────────────────────────────────────
  doc.font("Helvetica").fontSize(9).fillColor(GRAY)
    .text(`Roma, ${today}  ·  @superfluido_official`, MARGIN, doc.y, { width: contentW, align: "right" });
  doc.moveDown(0.5);

  // ── Divider ──────────────────────────────────────────────────────────────────
  doc.moveTo(MARGIN, doc.y).lineTo(pageW - MARGIN, doc.y)
    .strokeColor(LIGHT_GRAY).lineWidth(0.8).stroke();
  doc.moveDown(1);

  // ── Content ──────────────────────────────────────────────────────────────────
  parseMdToPdf(doc, content);

  // ── Footer (inline, after content) ───────────────────────────────────────────
  doc.moveDown(1.5);
  doc.moveTo(MARGIN, doc.y).lineTo(pageW - MARGIN, doc.y)
    .strokeColor(ORANGE).lineWidth(1.5).stroke();
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(8).fillColor(GRAY)
    .text(
      `SUPERFLUIDO — Hip-Hop Indipendente · Roma 2021    |    Generato il ${today}`,
      MARGIN, doc.y, { width: contentW, align: "center" },
    );

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
