import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import logo from "@/assets/aozora-logo.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputHeader,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { getThread } from "@/lib/threads.functions";

type ChatWindowProps = { threadId: string };

function AttachmentPreviews() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <PromptInputHeader>
      {attachments.files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => attachments.remove(file.id)}
          title={`Remove ${file.filename ?? "attachment"}`}
          className="group relative h-14 w-14 overflow-hidden rounded-lg border border-border"
        >
          {file.mediaType?.startsWith("image/") ? (
            <img src={file.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs">file</span>
          )}
          <span className="absolute inset-0 hidden items-center justify-center bg-background/70 text-xs group-hover:flex">
            Remove
          </span>
        </button>
      ))}
    </PromptInputHeader>
  );
}

async function toDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read attachment"));
    reader.readAsDataURL(blob);
  });
}

export function ChatWindow({ threadId }: ChatWindowProps) {
  const fetchThread = useServerFn(getThread);
  const queryClient = useQueryClient();
  const composerRef = useRef<HTMLDivElement | null>(null);

  const threadQuery = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
  });

  const initialMessages = useMemo<UIMessage[]>(
    () =>
      (threadQuery.data?.messages ?? []).map((message) => ({
        id: message.id,
        role: message.role,
        parts: message.parts as UIMessage["parts"],
      })),
    [threadQuery.data],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, headers }) => {
          const { data } = await supabase.auth.getSession();
          return {
            body: { messages, threadId },
            headers: {
              ...(headers as Record<string, string> | undefined),
              ...(data.session?.access_token
                ? { Authorization: `Bearer ${data.session.access_token}` }
                : {}),
            },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => {
      console.error(error);
      toast.error(error.message || "AozoraAi could not answer. Please try again.");
    },
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  const focusComposer = () => {
    composerRef.current?.querySelector("textarea")?.focus();
  };

  useEffect(() => {
    focusComposer();
  }, [threadId, status]);

  async function handleSubmit(message: PromptInputMessage) {
    const text = message.text.trim();
    const hasFiles = message.files.length > 0;
    if (!text && !hasFiles) return;

    try {
      const files = await Promise.all(
        message.files.map(async (file) => ({
          type: "file" as const,
          mediaType: file.mediaType,
          filename: file.filename ?? "attachment",
          url: file.url.startsWith("blob:") ? await toDataUrl(file.url) : file.url,
        })),
      );

      await sendMessage({ text, files });
    } catch (error) {
      console.error(error);
      toast.error("Could not attach that file.");
    }
  }

  const isBusy = status === "submitted" || status === "streaming";

  if (threadQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <img src={logo} alt="" width={22} height={22} className="h-5.5 w-5.5 md:hidden" />
        <h1 className="truncate text-sm font-medium">
          {threadQuery.data?.thread.title ?? "New chat"}
        </h1>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <img src={logo} alt="" width={56} height={56} className="h-14 w-14" />
              <h2 className="mt-6 text-2xl font-semibold">How can I help you today?</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask anything, attach an image, search the live web, or ask for a picture.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, index) => {
                  const key = `${message.id}-${index}`;

                  if (part.type === "text") {
                    return <MessageResponse key={key}>{part.text}</MessageResponse>;
                  }

                  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                    return (
                      <img
                        key={key}
                        src={part.url}
                        alt={part.filename ?? "Attached image"}
                        className="max-h-80 rounded-xl border border-border"
                      />
                    );
                  }

                  if (part.type === "tool-web_search" || part.type === "tool-generate_image") {
                    const isImage = part.type === "tool-generate_image";
                    const output = part.output as
                      { imageUrl?: string; prompt?: string; error?: string } | undefined;

                    return (
                      <div key={key} className="w-full space-y-3">
                        <Tool defaultOpen={false}>
                          <ToolHeader
                            type={part.type}
                            state={part.state}
                            title={isImage ? "Generating image" : "Searching the web"}
                          />
                          <ToolContent>
                            <ToolInput input={part.input} />
                            <ToolOutput
                              output={
                                part.output ? (
                                  <pre className="overflow-x-auto text-xs">
                                    {JSON.stringify(part.output, null, 2)}
                                  </pre>
                                ) : undefined
                              }
                              errorText={part.errorText}
                            />
                          </ToolContent>
                        </Tool>
                        {isImage && output?.imageUrl && (
                          <img
                            src={output.imageUrl}
                            alt={output.prompt ?? "Generated image"}
                            className="w-full max-w-lg rounded-2xl border border-border"
                          />
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking...</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-6" ref={composerRef}>
        <PromptInput onSubmit={handleSubmit} accept="image/*" multiple maxFiles={4}>
          <AttachmentPreviews />
          <PromptInputTextarea placeholder="Message AozoraAi…" autoFocus />
          <PromptInputFooter>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="Attach an image" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputSubmit status={status} onStop={stop} disabled={false} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          AozoraAi can make mistakes. Check important information.
        </p>
      </div>
      {isBusy ? <span className="sr-only">AozoraAi is responding</span> : null}
    </div>
  );
}
