import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Json[];
};

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary[]> => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
    }));
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary> => {
    const { data, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: "New chat" })
      .select("id, title, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return { id: data.id, title: data.title, updatedAt: data.updated_at };
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ thread: ThreadSummary; messages: StoredMessage[] } | null> => {
      const { data: thread, error: threadError } = await context.supabase
        .from("threads")
        .select("id, title, updated_at")
        .eq("id", data.threadId)
        .maybeSingle();

      if (threadError) throw new Error(threadError.message);
      if (!thread) return null;

      const { data: rows, error: messagesError } = await context.supabase
        .from("messages")
        .select("id, role, parts, created_at")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true });

      if (messagesError) throw new Error(messagesError.message);

      const messages: StoredMessage[] = (rows ?? []).map((row) => ({
        id: row.id,
        role: row.role as StoredMessage["role"],
        parts: Array.isArray(row.parts) ? (row.parts as Json[]) : [],
      }));

      return {
        thread: { id: thread.id, title: thread.title, updatedAt: thread.updated_at },
        messages,
      };
    },
  );

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ threadId: z.string().uuid(), title: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
