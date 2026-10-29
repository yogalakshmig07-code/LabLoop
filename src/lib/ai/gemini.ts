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

