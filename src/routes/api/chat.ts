import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { createLovableAiGatewayProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import { createImageGenerationTool, webSearchTool } from "@/lib/ai-tools.server";
import { supabaseFromRequest } from "@/lib/supabase-request.server";

const SYSTEM_PROMPT = `You are AozoraAi, a thoughtful, precise and friendly AI assistant. "Aozora" means "blue sky" in Japanese — keep answers clear, open and calm.

Guidelines:
- Use rich markdown: headings, lists, tables and fenced code blocks with language tags.
- Use the web_search tool for current events, recent facts, prices, people or anything you may not know. Cite sources as markdown links.
- Use the generate_image tool when the user asks for an image, illustration or visual. Do not describe the image instead of generating it.
- When the user attaches an image, analyse it directly.
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
              const title = titled.text.trim().replace(/^["']|["']$/g, "").slice(0, 80);
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
          messages: convertToModelMessages(uiMessages),
          tools: {
            web_search: webSearchTool,
            generate_image: createImageGenerationTool(apiKey),
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