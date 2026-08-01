import { tool } from "ai";
import { z } from "zod";

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean },
      ) => Promise<{ error: { message: string } | null }>;
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
};

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

export type SourceImage = { url: string; mediaType?: string | undefined; filename?: string | undefined };

function extractImage(payload: unknown): string | undefined {
  const body = payload as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    data?: { b64_json?: string; url?: string }[];
  };
  const fromChoices = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const first = body.data?.[0];
  const fromData = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
  return fromChoices ?? fromData;
}

export function createImageEditTool(lovableApiKey: string, sourceImages: SourceImage[]) {
  return tool({
    description:
      sourceImages.length > 0
        ? `Edit, enhance, restyle or modify the image the user attached to this message (${sourceImages.length} available). Use for "enhance", "upscale look", "brighten", "remove the background", "make it a poster", "change the colour" and any other change to an existing image.`
        : "Edit an attached image. No image is attached to the current message, so tell the user to attach one instead of calling this.",
    inputSchema: z.object({
      instruction: z
        .string()
        .describe(
          "What to change, written as a direct image-editing instruction, e.g. 'Enhance this photo: sharpen details, improve lighting and colour, remove noise. Keep the composition identical.'",
        ),
      imageIndex: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Which attached image to edit, 0 for the first. Defaults to 0."),
    }),
    execute: async ({ instruction, imageIndex }) => {
      const source = sourceImages[imageIndex ?? 0];
      if (!source) {
        return {
          instruction,
          error:
            "No image was attached to this message. Ask the user to attach the image they want edited.",
        };
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instruction },
                { type: "image_url", image_url: { url: source.url } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error("[edit_image] gateway error", response.status, detail);
        return { instruction, error: `Image editing failed (${response.status}).` };
      }

      const imageUrl = extractImage(await response.json());
      if (!imageUrl) {
        return {
          instruction,
          error: "The image model returned no edited image. Tell the user it could not be edited.",
        };
      }

      return { instruction, imageUrl };
    },
  });
}

export function createPdfTool(supabase: StorageClient, userId: string) {
  return tool({
    description:
      "Create a real, professionally formatted downloadable .pdf file. Use for every request for a PDF, report, resume/CV, invoice, letter, spec, handout, cheat sheet, plan or 'document I can download'. Never write HTML or a code block instead.",
    inputSchema: z.object({
      title: z.string().describe("Document title, shown large on the first page"),
      subtitle: z
        .string()
        .optional()
        .describe("Optional short subtitle or company name shown under the title"),
      filename: z
        .string()
        .optional()
        .describe("File name without extension, e.g. 'marketing-plan'"),
      content: z
        .string()
        .describe(
          "The full document body in markdown. Supported: '# '/'## '/'### ' headings, blank-line separated paragraphs, '- ' bullets, '1. ' numbered items, '> ' callouts, '---' rules, and GitHub-style pipe tables (use a |---|---| divider row, and |---:| for right-aligned number columns). Put all tabular data in real markdown tables.",
        ),
    }),
    execute: async ({ title, subtitle, filename, content }) => {
      try {
        const { renderPdf } = await import("./pdf-render.server");
        const { bytes, pages } = await renderPdf(title, content, subtitle);

        const safeName =
          (filename ?? title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60) || "document";
        const objectPath = `${userId}/documents/${crypto.randomUUID()}/${safeName}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });

        if (uploadError) {
          console.error("[create_pdf] upload failed", uploadError);
          return { title, error: "Could not save the PDF file." };
        }

        const { data: signed, error: signError } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(objectPath, 60 * 60 * 24 * 7);

        if (signError || !signed?.signedUrl) {
          console.error("[create_pdf] signing failed", signError);
          return { title, error: "The PDF was created but could not be shared." };
        }

        return {
          title,
          filename: `${safeName}.pdf`,
          pages,
          bytes: bytes.byteLength,
          url: signed.signedUrl,
          note: "The PDF is ready. Tell the user it is attached above and can be downloaded; do not repeat its full contents.",
        };
      } catch (error) {
        console.error("[create_pdf] failed", error);
        return { title, error: "PDF generation failed." };
      }
    },
  });
}
