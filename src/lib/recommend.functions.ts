import { createServerFn } from "@tanstack/react-start";

export type RecommendCandidate = {
  id: string;
  title: string;
  genre?: string | null;
  section?: string | null;
};

export type RecommendInput = {
  history: { title: string; genre?: string | null; section?: string | null }[];
  candidates: RecommendCandidate[];
};

/**
 * AI ranking for the "For You" page. Returns candidate ids ordered by how well
 * they match what this viewer has been watching.
 */
export const recommendMedia = createServerFn({ method: "POST" })
  .inputValidator((input: RecommendInput) => input)
  .handler(async ({ data }): Promise<{ ids: string[] }> => {
    const key = process.env["LOVABLE_API_KEY"];
    const candidates = (data.candidates ?? []).slice(0, 80);
    if (!key || !candidates.length) return { ids: candidates.map((c) => c.id) };

    const watched = (data.history ?? [])
      .slice(0, 15)
      .map((h) => `- ${h.title}${h.genre ? ` (${h.genre})` : ""}${h.section ? ` [${h.section}]` : ""}`)
      .join("\n");

    const catalog = candidates
      .map((c) => `${c.id} :: ${c.title}${c.genre ? ` | ${c.genre}` : ""}${c.section ? ` | ${c.section}` : ""}`)
      .join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a streaming recommendation engine. Rank catalog titles for a viewer. Reply with JSON only: {\"ids\":[\"id1\",\"id2\"]}. Use only ids from the catalog, best match first, no duplicates.",
            },
            {
              role: "user",
              content: `Recently watched:\n${watched || "(nothing yet — favour popular and varied titles)"}\n\nCatalog (id :: title | genre | section):\n${catalog}\n\nReturn the 40 best ids for this viewer.`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) return { ids: candidates.map((c) => c.id) };
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as { ids?: unknown };
      const valid = new Set(candidates.map((c) => c.id));
      const ids = Array.isArray(parsed.ids)
        ? (parsed.ids as unknown[]).filter((i): i is string => typeof i === "string" && valid.has(i))
        : [];
      const rest = candidates.map((c) => c.id).filter((id) => !ids.includes(id));
      return { ids: [...ids, ...rest] };
    } catch {
      return { ids: candidates.map((c) => c.id) };
    }
  });
