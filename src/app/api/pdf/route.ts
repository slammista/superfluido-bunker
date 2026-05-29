import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";

const ORANGE = "#f97316";
const BLACK = "#000000";
const DARK = "#222222";
const GRAY = "#888888";
const LIGHT_GRAY = "#e5e5e5";
const MARGIN = 56;
const FOOTER_HEIGHT = 55;

type Doc = PDFKit.PDFDocument;

function stripInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > doc.page.height - FOOTER_HEIGHT - 10) {
    doc.addPage();
  }
}

function parseMdToPdf(doc: Doc, markdown: string) {
  const pageW = doc.page.width;
  const contentW = pageW - MARGIN * 2;

  for (const raw of markdown.split("\n")) {
    const t = raw.trim();

    if (t === "" || t === "[PRINTABLE]") { doc.moveDown(0.3); continue; }

    if (t === "---" || t === "***") {
      ensureSpace(doc, 20);
      doc.moveDown(0.4);
      doc.moveTo(MARGIN, doc.y).lineTo(pageW - MARGIN, doc.y)
        .strokeColor(LIGHT_GRAY).lineWidth(0.5).stroke();
      doc.moveDown(0.6);
      continue;
    }

    if (t.startsWith("### ")) {
      ensureSpace(doc, 30);
      doc.moveDown(0.5);
      doc.font("Bold").fontSize(8).fillColor(GRAY)
        .text(stripInline(t.slice(4)).toUpperCase(), MARGIN, doc.y, { width: contentW, characterSpacing: 1 });
      doc.moveDown(0.25);
      continue;
    }

    if (t.startsWith("## ")) {
      ensureSpace(doc, 30);
      doc.moveDown(0.7);
      doc.font("Bold").fontSize(9).fillColor(ORANGE)
        .text(stripInline(t.slice(3)).toUpperCase(), MARGIN, doc.y, { width: contentW, characterSpacing: 1.5 });
      doc.moveDown(0.3);
      continue;
    }

    if (t.startsWith("# ")) {
      ensureSpace(doc, 40);
      doc.moveDown(0.8);
      doc.font("Bold").fontSize(17).fillColor(BLACK)
        .text(stripInline(t.slice(2)), MARGIN, doc.y, { width: contentW });
      doc.moveDown(0.4);
      continue;
    }

    if (/^[*-] /.test(t)) {
      ensureSpace(doc, 20);
      const item = t.slice(2);
      doc.font("Regular").fontSize(10.5).fillColor(DARK)
        .text("- " + stripInline(item), MARGIN, doc.y, { width: contentW });
      doc.moveDown(0.1);
      continue;
    }

    ensureSpace(doc, 20);
    doc.font("Regular").fontSize(11).fillColor(DARK)
      .text(stripInline(t), MARGIN, doc.y, { width: contentW });
    doc.moveDown(0.3);
  }
}

function drawFooter(doc: Doc) {
  const pageW = doc.page.width;
  const contentW = pageW - MARGIN * 2;
  const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const footerLineY = doc.page.height - FOOTER_HEIGHT;
  const footerTextY = doc.page.height - FOOTER_HEIGHT + 10;

  doc.moveTo(MARGIN, footerLineY).lineTo(pageW - MARGIN, footerLineY)
    .strokeColor(ORANGE).lineWidth(1.5).stroke();
  doc.font("Regular").fontSize(8).fillColor(GRAY)
    .text(
      `SUPERFLUIDO -- Hip-Hop Indipendente * Roma 2021    |    Generato il ${today}`,
      MARGIN, footerTextY, { width: contentW, align: "center" },
    );
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

  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const regularPath = path.join(fontsDir, "LiberationSans-Regular.ttf");
  const boldPath = path.join(fontsDir, "LiberationSans-Bold.ttf");

  const hasEmbeddedFonts = fs.existsSync(regularPath) && fs.existsSync(boldPath);

  const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateSlug = new Date().toISOString().slice(0, 10);

  const doc = new PDFDocument({ margin: MARGIN, size: "A4", autoFirstPage: true });

  if (hasEmbeddedFonts) {
    doc.registerFont("Regular", regularPath);
    doc.registerFont("Bold", boldPath);
  } else {
    doc.registerFont("Regular", "Helvetica");
    doc.registerFont("Bold", "Helvetica-Bold");
  }

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageW = doc.page.width;
  const contentW = pageW - MARGIN * 2;

  // ── Header ────────────────────────────────────────────────────────────────────
  doc.font("Bold").fontSize(7).fillColor(ORANGE)
    .text("SUPERFLUIDO * BUNKER OPERATING SYSTEM", MARGIN, MARGIN, { width: contentW, characterSpacing: 2 });
  doc.moveDown(0.5);

  doc.font("Bold").fontSize(26).fillColor(BLACK)
    .text(title, MARGIN, doc.y, { width: contentW });
  doc.moveDown(0.3);

  doc.font("Regular").fontSize(9).fillColor(GRAY)
    .text(`Roma, ${today}  *  @superfluido_official`, MARGIN, doc.y, { width: contentW, align: "right" });
  doc.moveDown(0.6);

  doc.moveTo(MARGIN, doc.y).lineTo(pageW - MARGIN, doc.y)
    .strokeColor(LIGHT_GRAY).lineWidth(0.8).stroke();
  doc.moveDown(1);

  // ── Content ───────────────────────────────────────────────────────────────────
  parseMdToPdf(doc, content);

  // ── Footer ────────────────────────────────────────────────────────────────────
  drawFooter(doc);

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
