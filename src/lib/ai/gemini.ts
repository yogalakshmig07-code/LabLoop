import "server-only";

export interface SmartMatchResourceItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  location?: string | null;
}

export interface SmartMatchResult {
  id: string;
  reason: string;
  score: number;
}

/**
 * Fallback scoring algorithm using keyword frequency & token matching
 * across name, category, and description.
 */
function keywordFallbackMatch(
  query: string,
  resources: SmartMatchResourceItem[]
): SmartMatchResult[] {
  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTokens.length === 0) {
    return [];
  }

  const results: SmartMatchResult[] = [];

  for (const r of resources) {
    let score = 0;
    const matches: string[] = [];

    const nameLower = r.name.toLowerCase();
    const catLower = r.category.toLowerCase();
    const descLower = (r.description || "").toLowerCase();
    const locLower = (r.location || "").toLowerCase();

    for (const token of queryTokens) {
      if (nameLower.includes(token)) {
        score += 35;
        matches.push(`name matches "${token}"`);
      } else if (catLower.includes(token)) {
        score += 25;
        matches.push(`category matches "${token}"`);
      } else if (descLower.includes(token)) {
        score += 15;
        matches.push(`matches "${token}"`);
      } else if (locLower.includes(token)) {
        score += 10;
      }
    }

    if (score > 0) {
      results.push({
        id: r.id,
        score: Math.min(score, 100),
        reason:
          matches.length > 0
            ? `Matched based on keyword criteria (${matches.slice(0, 2).join(", ")})`
            : "General keyword relevance match",
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Connects to Google Gemini REST API using generateContent with responseMimeType="application/json".
 * Falls back to local keyword ranking if key is missing, network fails, or times out after 8s.
 */
export async function smartMatchResources(
  query: string,
  resources: SmartMatchResourceItem[]
): Promise<SmartMatchResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!query || !query.trim() || resources.length === 0) {
    return [];
  }

  // If no Gemini key is provided, gracefully use keyword fallback
  if (!apiKey || apiKey === "your-gemini-api-key") {
    return keywordFallbackMatch(query, resources);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are LabLoop Smart Match, an intelligent assistant for a university campus lab & equipment sharing platform.
A student or faculty member is looking for a campus resource with the query: "${query}"

Here is the list of available campus resources:
${JSON.stringify(
  resources.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
  })),
  null,
  2
)}

Analyze the query and rank the top matching resources.
Return a JSON array of objects with the following schema:
[
  {
    "id": "uuid-of-resource",
    "score": 95, // integer 1-100 indicating relevance
    "reason": "Clear concise 1-sentence explanation of why this matches the request"
  }
]
Only return resources that are genuinely relevant (score >= 40). Return max 5 items. If none are relevant, return an empty array [].`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("Gemini API request failed with status:", response.status);
      return keywordFallbackMatch(query, resources);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return keywordFallbackMatch(query, resources);
    }

    const parsed: SmartMatchResult[] = JSON.parse(candidateText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Validate that returned IDs actually exist in the resource list
      const validResourceIds = new Set(resources.map((r) => r.id));
      const validResults = parsed.filter((item) => validResourceIds.has(item.id));
      if (validResults.length > 0) {
        return validResults.sort((a, b) => b.score - a.score);
      }
    }

    return keywordFallbackMatch(query, resources);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn("Gemini smart match encountered error or timed out:", err.message);
    return keywordFallbackMatch(query, resources);
  }
}

export interface IncidentSummaryContext {
  incidentType: string;
  severity: string;
  description: string;
  resourceName: string;
  resourceCategory?: string;
  checkoutGrade?: string | null;
  checkoutNotes?: string | null;
  checkoutChecklist?: Record<string, boolean> | null;
  returnGrade?: string | null;
  returnNotes?: string | null;
  returnChecklist?: Record<string, boolean> | null;
}

export function generateFallbackIncidentSummary(ctx: IncidentSummaryContext): string {
  const regressed: string[] = [];
  if (ctx.checkoutChecklist && ctx.returnChecklist) {
    for (const [k, v] of Object.entries(ctx.checkoutChecklist)) {
      if (v === true && ctx.returnChecklist[k] === false) {
        regressed.push(k);
      }
    }
  }

  const s1 = `Reported ${ctx.severity} severity ${ctx.incidentType} on "${ctx.resourceName}": "${ctx.description.trim()}".`;
  const s2 =
    ctx.checkoutGrade && ctx.returnGrade
      ? `Inspection records indicate check-out baseline was ${ctx.checkoutGrade.toUpperCase()} and return verification was ${ctx.returnGrade.toUpperCase()}${
          regressed.length > 0 ? ` with checklist defects noted on: ${regressed.join(", ")}` : ""
        }.`
      : `Physical inspection record is ${
          ctx.returnGrade ? `graded ${ctx.returnGrade.toUpperCase()}` : "pending or unavailable for this session"
        }.`;
  const s3 =
    ctx.checkoutNotes || ctx.returnNotes
      ? `Inspection notes recorded: "${[ctx.checkoutNotes, ctx.returnNotes].filter(Boolean).join(" | ")}".`
      : "No conflicting physical defects were logged during baseline handover.";
  const s4 = `Facility managers should inspect the equipment in person and speak with the borrower before determining whether formal repairs, safety re-training, or account penalties are warranted.`;

  return `${s1} ${s2} ${s3} ${s4}`;
}

/**
 * Generates an advisory incident analysis using Google Gemini.
 * Summarizes:
 * 1. What happened
 * 2. Evidence available (check-out / return condition reports, checklists, notes)
 * 3. Suggested next step
 *
 * Falls back to a deterministic rule-based summary if the API times out (8s) or is unavailable.
 */
export async function generateIncidentSummary(
  ctx: IncidentSummaryContext
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey || apiKey === "your-gemini-api-key") {
    return generateFallbackIncidentSummary(ctx);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are LabLoop Incident Assistant for university laboratory resource sharing.
Write a concise, objective 3 to 4 sentence incident summary based on the following report details:
- Resource: ${ctx.resourceName} (${ctx.resourceCategory || "equipment"})
- Incident Type: ${ctx.incidentType}
- Declared Severity: ${ctx.severity}
- User Description: "${ctx.description}"
- Check-out Condition Grade: ${ctx.checkoutGrade || "N/A"}
- Check-out Notes: ${ctx.checkoutNotes || "None"}
- Check-out Checklist: ${JSON.stringify(ctx.checkoutChecklist || {})}
- Return Condition Grade: ${ctx.returnGrade || "N/A"}
- Return Notes: ${ctx.returnNotes || "None"}
- Return Checklist: ${JSON.stringify(ctx.returnChecklist || {})}

Requirements for the summary:
1. Cover what happened (the core reported issue and severity).
2. Detail the evidence available (compare check-out vs return physical inspection grades, checklists, and notes).
3. Suggest a concrete next step for the human facility reviewer (e.g., physical inspection, mediation with borrower, maintenance check, or closure).
4. Strictly 3 to 4 sentences in length. Professional, factual, and neutral tone. Do not mention you are an AI or preface your output.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 250,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("Gemini incident summary failed with status:", response.status);
      return generateFallbackIncidentSummary(ctx);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || typeof candidateText !== "string") {
      return generateFallbackIncidentSummary(ctx);
    }

    return candidateText.trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn("Gemini incident summary timed out or error:", err.message);
    return generateFallbackIncidentSummary(ctx);
  }
}


