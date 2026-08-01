import { tool } from "ai";
import { z } from "zod";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchWeb(query: string, limit: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const instant = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    );
    if (instant.ok) {
      const data = (await instant.json()) as {
        Heading?: string;
        AbstractText?: string;
        AbstractURL?: string;
        RelatedTopics?: { Text?: string; FirstURL?: string }[];
      };
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
          source: "DuckDuckGo",
        });
      }
      for (const topic of data.RelatedTopics ?? []) {
        if (results.length >= limit) break;
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] ?? topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
            source: "DuckDuckGo",
          });
        }
      }
    }
  } catch (error) {
    console.error("[web_search] duckduckgo failed", error);
  }

  if (results.length < limit) {
    try {
      const wiki = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query,
        )}&format=json&srlimit=${limit}&origin=*`,
      );
      if (wiki.ok) {
        const data = (await wiki.json()) as {
          query?: { search?: { title: string; snippet: string }[] };
        };
        for (const hit of data.query?.search ?? []) {
          if (results.length >= limit) break;
          results.push({
            title: hit.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`,
            snippet: stripHtml(hit.snippet),
            source: "Wikipedia",
          });
        }
      }
    } catch (error) {
      console.error("[web_search] wikipedia failed", error);
    }
  }

  return results.slice(0, limit);
}

export const webSearchTool = tool({
  description:
    "Search the public web for up-to-date facts, definitions, people, places and events. Returns titles, URLs and snippets you must cite in your answer.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }) => {
    const results = await searchWeb(query, 6);
    return {
      query,
      results,
      note:
        results.length === 0
          ? "No results found. Answer from your own knowledge and say the search returned nothing."
          : undefined,
    };
  },
});

export function createImageGenerationTool(lovableApiKey: string) {
  return tool({
    description:
      "Generate an original image from a text description. Use when the user asks for a picture, illustration, logo, artwork or visual concept.",
    inputSchema: z.object({
      prompt: z.string().describe("Detailed description of the image to create"),
    }),
    execute: async ({ prompt }) => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error("[generate_image] gateway error", response.status, detail);
        return { prompt, error: `Image generation failed (${response.status}).` };
      }

      const payload = (await response.json()) as {
        choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
        data?: { b64_json?: string; url?: string }[];
      };

      const fromChoices = payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const fromData = payload.data?.[0]?.b64_json
        ? `data:image/png;base64,${payload.data[0].b64_json}`
        : payload.data?.[0]?.url;
      const imageUrl = fromChoices ?? fromData;

      if (!imageUrl) {
        return { prompt, error: "The model returned no image." };
      }

      return { prompt, imageUrl };
    },
  });
}
