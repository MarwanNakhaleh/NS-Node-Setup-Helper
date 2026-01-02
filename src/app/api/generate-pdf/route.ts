import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { NextRequest } from "next/server";

// If you ever hit Edge-runtime issues with pdf-lib, uncomment this:
// export const runtime = "nodejs";

type Recommendation = {
  serviceId?: string;
  serviceName?: string;
  estimatedInitialCost?: number | string;
  estimatedMonthlyCost?: number | string;
  steps?: string[];
  specificRecommendations?: string;
  sources?: string[];
};

type ParsedDoc =
  | {
      recommendations?: Recommendation[];
      totalEstimatedInitialCost?: number | string;
      totalEstimatedMonthlyCost?: number | string;
      notes?: string;
      totalEstimatedCostOverBudget?: number | string | null;
      overBudgetReason?: string;
    }
  | Recommendation[];

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    // remove commas and $ if present
    const cleaned = val.replace(/[$,]/g, "").trim();
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function formatMoney(val: unknown): string | undefined {
  const n = coerceNumber(val);
  if (n === undefined) return undefined;
  return `$${n.toLocaleString()}`;
}

/**
 * Attempts to parse:
 * - raw JSON string
 * - ```json ... ``` fenced JSON
 * - "double encoded" JSON string (a JSON string that contains the markdown/json)
 */
function parseJsonFromString(input: string): any | undefined {
  const s = input.trim();

  // 1) If it's a JSON-encoded string (starts/ends with quotes), decode once
  //    Example: "\"```json\n{...}\n```\""
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    try {
      const decoded = JSON.parse(s);
      if (typeof decoded === "string") {
        const again = parseJsonFromString(decoded);
        if (again !== undefined) return again;
        // if not parseable, fall through to other attempts using decoded
        input = decoded;
      }
    } catch {
      // ignore
    }
  }

  const text = (typeof input === "string" ? input : s).trim();

  // 2) Extract from fenced block if present
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = text.match(fenceRegex);
  const candidate = (match?.[1] ?? text).trim();

  // 3) Try parsing candidate as JSON
  try {
    return JSON.parse(candidate);
  } catch {
    // 4) Try parsing original (sometimes candidate stripping hurts)
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
}

/**
 * Normalizes whatever came in (string/object/array) into either:
 * - structured data (recommendations + optional summary), OR
 * - rawText fallback
 */
function normalizeInput(body: any): { doc?: any; rawText?: string } {
  // If the whole body is a string (common when posting markdown or json-as-string)
  if (typeof body === "string") {
    const parsed = parseJsonFromString(body);
    if (parsed !== undefined) return { doc: parsed };
    return { rawText: body };
  }

  // If body is an array already
  if (Array.isArray(body)) {
    return { doc: body };
  }

  // If body is an object, it might contain recommendations in various shapes
  if (isPlainObject(body)) {
    // Common: { recommendations: ... }
    if ("recommendations" in body) {
      const r = body.recommendations;

      // If recommendations is a string, try parsing it (it might contain the WHOLE object)
      if (typeof r === "string") {
        const parsed = parseJsonFromString(r);
        if (parsed !== undefined) return { doc: parsed };
        return { rawText: r };
      }

      // If recommendations is { raw: true, text: "..." } style
      if (isPlainObject(r) && typeof r.text === "string") {
        const parsed = parseJsonFromString(r.text);
        if (parsed !== undefined) return { doc: parsed };
        return { rawText: r.text };
      }

      // If recommendations is already an array, keep the surrounding summary fields from body
      if (Array.isArray(r)) {
        return { doc: body };
      }

      // If recommendations is itself an object containing recommendations, accept it
      if (isPlainObject(r)) {
        return { doc: r };
      }
    }

    // Some callers might send { raw: true, text: "..." } at the top level
    if (typeof body.text === "string") {
      const parsed = parseJsonFromString(body.text);
      if (parsed !== undefined) return { doc: parsed };
      return { rawText: body.text };
    }

    // As a last attempt, stringify and see if it includes a parseable blob
    try {
      const str = JSON.stringify(body);
      const parsed = parseJsonFromString(str);
      if (parsed !== undefined) return { doc: parsed };
    } catch {
      // ignore
    }
  }

  // Unknown shape
  return { rawText: typeof body === "string" ? body : JSON.stringify(body, null, 2) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { doc, rawText } = normalizeInput(body);

    // Build structured view: recommendations + summary
    let recommendations: Recommendation[] = [];
    let summary: {
      totalEstimatedInitialCost?: any;
      totalEstimatedMonthlyCost?: any;
      notes?: any;
      totalEstimatedCostOverBudget?: any;
      overBudgetReason?: any;
    } = {};

    if (doc !== undefined) {
      if (Array.isArray(doc)) {
        // doc is a recommendations array
        recommendations = doc as Recommendation[];
      } else if (isPlainObject(doc)) {
        // doc might be the whole object with recommendations + totals
        if (Array.isArray(doc.recommendations)) {
          recommendations = doc.recommendations as Recommendation[];
          summary = {
            totalEstimatedInitialCost: doc.totalEstimatedInitialCost,
            totalEstimatedMonthlyCost: doc.totalEstimatedMonthlyCost,
            notes: doc.notes,
            totalEstimatedCostOverBudget: doc.totalEstimatedCostOverBudget,
            overBudgetReason: doc.overBudgetReason,
          };
        } else if (Array.isArray((doc as any))) {
          recommendations = doc as any;
        }
      }
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    const PAGE_W = 612; // US Letter
    const PAGE_H = 792;
    const margin = 50;
    const bottomMargin = 50;
    const contentWidth = PAGE_W - 2 * margin;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = PAGE_H - 50;

    const newPage = () => {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 50;
    };

    const ensureSpace = (neededHeight: number) => {
      if (y - neededHeight < bottomMargin) newPage();
    };

    const drawWrappedText = (opts: {
      text: string;
      x: number;
      size: number;
      font: any;
      color?: ReturnType<typeof rgb>;
      maxWidth: number;
      lineGap?: number;
    }) => {
      const { text, x, size, font, maxWidth } = opts;
      const color = opts.color ?? rgb(0, 0, 0);
      const lineGap = opts.lineGap ?? 1.2;

      // Support explicit newlines as paragraph breaks
      const paragraphs = String(text).split(/\r?\n/);

      const lineHeight = size * lineGap;

      for (let p = 0; p < paragraphs.length; p++) {
        const paragraph = paragraphs[p].trim();

        // blank line
        if (!paragraph) {
          ensureSpace(lineHeight);
          y -= lineHeight;
          continue;
        }

        const words = paragraph.split(/\s+/);
        let line = "";

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const w = font.widthOfTextAtSize(testLine, size);

          if (w > maxWidth && line) {
            ensureSpace(lineHeight);
            page.drawText(line, { x, y, size, font, color });
            y -= lineHeight;
            line = word;
          } else {
            line = testLine;
          }
        }

        if (line) {
          ensureSpace(lineHeight);
          page.drawText(line, { x, y, size, font, color });
          y -= lineHeight;
        }

        // paragraph spacing
        if (p < paragraphs.length - 1) {
          ensureSpace(lineHeight * 0.4);
          y -= lineHeight * 0.4;
        }
      }
    };

    const drawHeading = (text: string, size: number) => {
      ensureSpace(size * 1.6);
      page.drawText(text, { x: margin, y, size, font: helveticaBoldFont, color: rgb(0, 0, 0) });
      y -= size * 1.6;
    };

    const drawDivider = () => {
      ensureSpace(12);
      // Simple divider using underscore text (pdf-lib line drawing is also possible; this is quick + stable)
      page.drawText("______________________________________________________________", {
        x: margin,
        y,
        size: 10,
        font: helveticaFont,
        color: rgb(0.85, 0.85, 0.85),
      });
      y -= 18;
    };

    // Title
    drawHeading("Society-as-a-Service Recommendations", 24);

    // Date
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    ensureSpace(18);
    page.drawText(`Generated on: ${date}`, {
      x: margin,
      y,
      size: 10,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 26;

    // If we have summary, print it
    const hasSummary =
      summary.totalEstimatedInitialCost !== undefined ||
      summary.totalEstimatedMonthlyCost !== undefined ||
      summary.notes ||
      summary.totalEstimatedCostOverBudget !== undefined ||
      summary.overBudgetReason;

    if (hasSummary) {
      drawHeading("Summary", 18);

      const initial = formatMoney(summary.totalEstimatedInitialCost);
      if (initial) {
        drawWrappedText({
          text: `Total Estimated Initial Cost: ${initial}`,
          x: margin,
          size: 12,
          font: helveticaFont,
          maxWidth: contentWidth,
        });
      }

      const monthly = formatMoney(summary.totalEstimatedMonthlyCost);
      if (monthly) {
        drawWrappedText({
          text: `Total Estimated Monthly Cost: ${monthly}`,
          x: margin,
          size: 12,
          font: helveticaFont,
          maxWidth: contentWidth,
        });
      }

      const over = coerceNumber(summary.totalEstimatedCostOverBudget);
      if (over !== undefined) {
        drawWrappedText({
          text: `Over Budget: $${over.toLocaleString()}`,
          x: margin,
          size: 12,
          font: helveticaFont,
          maxWidth: contentWidth,
          color: rgb(0.8, 0, 0),
        });
      }

      if (summary.overBudgetReason) {
        drawWrappedText({
          text: `Reason: ${summary.overBudgetReason}`,
          x: margin,
          size: 11,
          font: helveticaFont,
          maxWidth: contentWidth,
          color: rgb(0.8, 0, 0),
        });
      }

      if (summary.notes) {
        y -= 6;
        drawWrappedText({
          text: "Notes:",
          x: margin,
          size: 12,
          font: helveticaBoldFont,
          maxWidth: contentWidth,
        });
        drawWrappedText({
          text: String(summary.notes),
          x: margin,
          size: 11,
          font: helveticaFont,
          maxWidth: contentWidth,
        });
      }

      y -= 8;
      drawDivider();
    }

    // Recommendations section (structured)
    if (recommendations.length > 0) {
      drawHeading("Recommendations", 18);

      for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i] ?? {};

        // Service title
        const title = `${i + 1}. ${rec.serviceName || rec.serviceId || "Service"}`;
        ensureSpace(26);
        page.drawText(title, { x: margin, y, size: 14, font: helveticaBoldFont, color: rgb(0, 0, 0) });
        y -= 20;

        // Costs
        const initCost = formatMoney(rec.estimatedInitialCost);
        if (initCost) {
          drawWrappedText({
            text: `Initial Cost: ${initCost}`,
            x: margin,
            size: 11,
            font: helveticaFont,
            maxWidth: contentWidth,
          });
        }

        const monCost = formatMoney(rec.estimatedMonthlyCost);
        if (monCost) {
          drawWrappedText({
            text: `Monthly Cost: ${monCost}`,
            x: margin,
            size: 11,
            font: helveticaFont,
            maxWidth: contentWidth,
          });
        }

        y -= 4;

        // Steps
        if (Array.isArray(rec.steps) && rec.steps.length > 0) {
          drawWrappedText({
            text: "Steps:",
            x: margin,
            size: 12,
            font: helveticaBoldFont,
            maxWidth: contentWidth,
          });

          for (let s = 0; s < rec.steps.length; s++) {
            drawWrappedText({
              text: `${s + 1}. ${rec.steps[s]}`,
              x: margin + 12,
              size: 10,
              font: helveticaFont,
              maxWidth: contentWidth - 12,
            });
          }

          y -= 4;
        }

        // Specific recommendations
        if (rec.specificRecommendations) {
          drawWrappedText({
            text: "Recommendations:",
            x: margin,
            size: 12,
            font: helveticaBoldFont,
            maxWidth: contentWidth,
          });

          drawWrappedText({
            text: rec.specificRecommendations,
            x: margin,
            size: 10,
            font: helveticaFont,
            maxWidth: contentWidth,
          });

          y -= 4;
        }

        // Sources
        if (Array.isArray(rec.sources) && rec.sources.length > 0) {
          drawWrappedText({
            text: "Sources:",
            x: margin,
            size: 12,
            font: helveticaBoldFont,
            maxWidth: contentWidth,
          });

          for (const source of rec.sources) {
            drawWrappedText({
              text: String(source),
              x: margin + 12,
              size: 9,
              font: helveticaFont,
              maxWidth: contentWidth - 12,
              color: rgb(0, 0, 0.7),
            });
          }
        }

        y -= 10;
        drawDivider();
      }
    } else {
      // Fallback: Raw text (covers all “couldn’t parse” cases, including when the body was a plain string)
      const fallback = rawText ?? (typeof body === "string" ? body : "");
      if (fallback && fallback.trim().length > 0) {
        drawHeading("Recommendations (Raw)", 18);
        drawWrappedText({
          text: fallback,
          x: margin,
          size: 10,
          font: helveticaFont,
          maxWidth: contentWidth,
        });
      } else {
        drawHeading("No recommendations found", 18);
        drawWrappedText({
          text:
            "The request body did not contain parseable recommendations. " +
            "Send either: (1) a full object with a `recommendations` array, (2) a recommendations array, or (3) a string containing JSON (optionally inside ```json code fences```)",
          x: margin,
          size: 10,
          font: helveticaFont,
          maxWidth: contentWidth,
        });
      }
    }

    // Serialize the PDF
    const pdfBytes = await pdfDoc.save();

    // Convert Uint8Array to ArrayBuffer for Response
    // Create a new Uint8Array copy to ensure we have a regular ArrayBuffer
    const arrayBuffer = new Uint8Array(pdfBytes).buffer;

    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="recommendations.pdf"',
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return Response.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
