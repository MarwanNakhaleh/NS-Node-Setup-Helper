import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { generateRecommendationsPrompt } from "@/lib/prompt";
import type { NextRequest } from "next/server";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Extracts and parses JSON from:
 * - plain JSON string: "{...}" or "[...]"
 * - fenced JSON: ```json ... ```
 * - double-encoded JSON strings (a JSON string that itself contains JSON or fences)
 *
 * Returns parsed JS value if successful, otherwise null.
 */
function parseModelJson(text: string): any | null {
  if (!text || typeof text !== "string") return null;

  const trimmed = text.trim();

  // 1) Handle "double-encoded" outputs: "\"```json ... ```\"" or "\"{...}\""
  // Try decoding once; if it becomes a string, try parsing again.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      const decoded = JSON.parse(trimmed);
      if (typeof decoded === "string") {
        const again = parseModelJson(decoded);
        if (again !== null) return again;
        // fallthrough: continue attempts with decoded as the text
        return parseModelJson(String(decoded));
      }
    } catch {
      // ignore
    }
  }

  // 2) Try parse as pure JSON first
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }

  // 3) Try extract from a ```json fenced block (allow optional language tag and whitespace)
  // This matches the *first* fenced block. If you want the last, you can iterate matches.
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = trimmed.match(fenceRegex);
  if (match?.[1]) {
    const candidate = match[1].trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // ignore
    }
  }

  // 4) Extra robustness: find the first "{" or "[" and try to parse the substring.
  // (Helps when the model writes: "Here you go:\n{...}")
  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);

  if (start !== -1) {
    const maybeJson = trimmed.slice(start).trim();
    try {
      return JSON.parse(maybeJson);
    } catch {
      // ignore
    }
  }

  return null;
}

function unwrapRecommendations(parsed: any) {
  // If the model returned { recommendations: ... }, use that inner value
  if (parsed && typeof parsed === "object" && "recommendations" in parsed) {
    return parsed.recommendations;
  }
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const answers = body.answers;

    const prompt = generateRecommendationsPrompt(answers);

    const llmName = process.env.USE_PAID_MODEL
      ? process.env.OPENROUTER_PAID_MODEL
      : process.env.OPENROUTER_FREE_MODEL;

    const model = openrouter(llmName || "", {
      usage: { include: true },
      extraBody: {
        web_search: true,
      },
    });

    const result = await generateText({
      model,
      prompt,
    });

    const parsed = parseModelJson(result.text);

    const recommendations =
      parsed !== null
        ? unwrapRecommendations(parsed)
        : { text: result.text, raw: true };

    // Optional: helpful debugging during development
    // console.log("LLM raw text:", result.text);
    // console.log("LLM parsed recommendations type:", typeof recommendations);

    return Response.json({
      recommendations,
      usage: result.providerMetadata?.openrouter?.usage,
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return Response.json(
      {
        error: "Failed to generate recommendations",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
