import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Download, FileText } from "lucide-react";
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

function AttachmentPreviews({ clearRef }: { clearRef: React.MutableRefObject<(() => void) | null> }) {
  const attachments = usePromptInputAttachments();
  clearRef.current = attachments.clear;
  if (attachments.files.length === 0) return null;

  return (
    <PromptInputHeader>
      {attachments.files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => attachments.remove(file.id)}
          title={`Remove ${file.filename ?? "attachment"}`}
          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border sm:h-14 sm:w-14"
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

  const threadQuery = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
  });

  if (threadQuery.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  const history: UIMessage[] = (threadQuery.data?.messages ?? []).map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts as UIMessage["parts"],
  }));

  return (
    <ChatThread
      key={threadId}
      threadId={threadId}
      title={threadQuery.data?.thread.title ?? "New chat"}
      initialMessages={history}
    />
  );
}

function ChatThread({
  threadId,
  title,
  initialMessages,
}: {
  threadId: string;
  title: string;
  initialMessages: UIMessage[];
}) {
  const queryClient = useQueryClient();
  const composerRef = useRef<HTMLDivElement | null>(null);

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
      clearAttachmentsRef.current?.();
    } catch (error) {
      console.error(error);
      toast.error("Could not attach that file.");
    }
  }

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="hidden items-center gap-2 border-b border-border px-5 py-3 md:flex">
        <h1 className="truncate text-sm font-medium">{title}</h1>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center sm:py-20">
              <img src={logo} alt="" width={56} height={56} className="h-12 w-12 sm:h-14 sm:w-14" />
              <h2 className="mt-5 text-xl font-semibold sm:mt-6 sm:text-2xl">
                How can I help you today?
              </h2>
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
                        className="h-auto max-h-72 w-auto max-w-full rounded-xl border border-border sm:max-h-80"
                      />
                    );
                  }

                  if (
                    part.type === "tool-web_search" ||
                    part.type === "tool-generate_image" ||
                    part.type === "tool-edit_image" ||
                    part.type === "tool-create_pdf"
                  ) {
                    const isImage =
                      part.type === "tool-generate_image" || part.type === "tool-edit_image";
                    const isPdf = part.type === "tool-create_pdf";
                    const output = part.output as
                      | {
                          imageUrl?: string;
                          prompt?: string;
                          instruction?: string;
                          error?: string;
                          url?: string;
                          filename?: string;
                          pages?: number;
                          bytes?: number;
                        }
                      | undefined;
                    const label = isPdf
                      ? "Creating PDF"
                      : part.type === "tool-edit_image"
                        ? "Editing image"
                        : part.type === "tool-generate_image"
                          ? "Generating image"
                          : "Searching the web";

                    return (
                      <div key={key} className="w-full space-y-3">
                        <Tool defaultOpen={false}>
                          <ToolHeader
                            type={part.type}
                            state={part.state}
                            title={label}
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
                          <div className="space-y-2">
                            <img
                              src={output.imageUrl}
                              alt={output.prompt ?? output.instruction ?? "Generated image"}
                              className="h-auto w-full max-w-lg rounded-2xl border border-border"
                            />
                            <a
                              href={output.imageUrl}
                              download="aozora-image.png"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download image
                            </a>
                          </div>
                        )}
                        {isPdf && output?.url && (
                          <a
                            href={output.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/60"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                              <FileText className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {output.filename ?? "document.pdf"}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                PDF
                                {output.pages ? ` · ${output.pages} page${output.pages > 1 ? "s" : ""}` : ""}
                                {output.bytes ? ` · ${Math.max(1, Math.round(output.bytes / 1024))} KB` : ""}
                              </span>
                            </span>
                            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </a>
                        )}
                        {output?.error && (
                          <p className="text-sm text-destructive">{output.error}</p>
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

      <div
        className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-6"
        ref={composerRef}
      >
        <PromptInput onSubmit={handleSubmit} accept="image/*" multiple maxFiles={4}>
          <AttachmentPreviews />
          <PromptInputTextarea
            placeholder="Message AozoraAi…"
            autoFocus
            className="text-base sm:text-sm"
          />
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
        <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
          AozoraAi can make mistakes. Check important information.
        </p>
      </div>
      {isBusy ? <span className="sr-only">AozoraAi is responding</span> : null}
    </div>
  );
}
