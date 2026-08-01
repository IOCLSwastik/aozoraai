import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, generateText, stepCountIs, streamText, type UIMessage } from "ai";

import { createLovableAiGatewayProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import {
  createImageEditTool,
  createImageGenerationTool,
  createPdfTool,
  webSearchTool,
  type SourceImage,
} from "@/lib/ai-tools.server";
import { supabaseFromRequest } from "@/lib/supabase-request.server";

const SYSTEM_PROMPT = `You are AozoraAi, a thoughtful, precise and friendly AI assistant. "Aozora" means "blue sky" in Japanese — keep answers clear, open and calm.

Guidelines:
- Use rich markdown: headings, lists, tables and fenced code blocks with language tags.
- Use the web_search tool for current events, recent facts, prices, people or anything you may not know. Cite sources as markdown links.
- Use the generate_image tool when the user asks for a NEW image, illustration or visual from a description. Do not describe the image instead of generating it.
- When the user attaches an image and asks for any change to it — enhance, upscale-looking cleanup, brighten, retouch, restyle, remove or replace the background, add or remove something, turn it into art — you MUST call the edit_image tool with a concrete editing instruction. Never reply with only text or advice in that case, and never use generate_image when a source image is attached.
- When the user attaches an image and only asks a question about it, analyse it directly.
- When the user asks for a PDF, report, resume, CV, invoice, letter, handout, cheat sheet or any downloadable document, you MUST call the create_pdf tool and pass the full document content. Never output HTML, never put the document in a code block, and never claim you cannot create files.
- After a tool returns a file or image, keep your reply short: say what you made and that it is shown above.
- Be concise by default and go deeper when asked.`;

type ChatRequestBody = { messages?: unknown; threadId?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        const messages = body.messages;
        const threadId = typeof body.threadId === "string" ? body.threadId : null;

        if (!Array.isArray(messages) || !threadId) {
          return new Response("messages and threadId are required", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI is not configured", { status: 500 });
        }

        const auth = await supabaseFromRequest(request);
        if (!auth) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabase, userId } = auth;

        const { data: thread, error: threadError } = await supabase
          .from("threads")
          .select("id, title")
          .eq("id", threadId)
          .maybeSingle();

        if (threadError) {
          console.error("[chat] thread lookup failed", threadError);
          return new Response("Could not load conversation", { status: 500 });
        }
        if (!thread) {
          return new Response("Conversation not found", { status: 404 });
        }

        const uiMessages = messages as UIMessage[];
        const lastMessage = uiMessages.at(-1);

        const sourceImages: SourceImage[] = ((lastMessage?.parts ?? []) as unknown[])
          .map((part) => part as { type?: string; url?: string; mediaType?: string; filename?: string })
          .filter(
            (part) =>
              part.type === "file" &&
              typeof part.url === "string" &&
              (part.mediaType ?? "").startsWith("image/"),
          )
          .map((part) => ({
            url: part.url as string,
            mediaType: part.mediaType,
            filename: part.filename,
          }));

        if (lastMessage?.role === "user") {
          const { error: insertError } = await supabase.from("messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: lastMessage.parts as never,
            client_message_id: lastMessage.id,
          });
          if (insertError) console.error("[chat] failed to save user message", insertError);
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(apiKey, initialRunId);
        const model = gateway("openai/gpt-5.6-sol");

        if (thread.title === "New chat" && lastMessage?.role === "user") {
          const firstText = lastMessage.parts
            .filter((part): part is { type: "text"; text: string } => part.type === "text")
            .map((part) => part.text)
            .join(" ")
            .slice(0, 500);

          if (firstText.trim()) {
            try {
              const titled = await generateText({
                model,
                prompt: `Write a short conversation title (max 5 words, no quotes, no trailing period) for this first message:\n\n${firstText}`,
                providerOptions: { lovable: { reasoningEffort: "none" } },
              });
              const title = titled.text
                .trim()
                .replace(/^["']|["']$/g, "")
                .slice(0, 80);
              if (title) {
                await supabase.from("threads").update({ title }).eq("id", threadId);
              }
            } catch (error) {
              console.error("[chat] title generation failed", error);
            }
          }
        }

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(uiMessages),
          tools: {
            web_search: webSearchTool,
            generate_image: createImageGenerationTool(apiKey),
            edit_image: createImageEditTool(apiKey, sourceImages),
            create_pdf: createPdfTool(supabase, userId),
          },
          stopWhen: stepCountIs(50),
          providerOptions: { lovable: { reasoningEffort: "none" } },
          onError: ({ error }) => console.error("[chat] stream error", error),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            if (!responseMessage) return;
            const { error } = await supabase.from("messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              parts: responseMessage.parts as never,
              client_message_id: responseMessage.id,
            });
            if (error) console.error("[chat] failed to save assistant message", error);
            await supabase
              .from("threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});
