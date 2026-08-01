import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import logo from "@/assets/aozora-logo.png";
import { AccountDialog } from "@/components/chat/AccountDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ensureSession, resetSession } from "@/lib/session";
import { createThread, deleteThread, listThreads } from "@/lib/threads.functions";
import { cn } from "@/lib/utils";

type ThreadListProps = {
  /** Called after any navigation so a mobile drawer can close itself. */
  onNavigate?: () => void;
};

export function ThreadList({ onNavigate }: ThreadListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;
  const [accountOpen, setAccountOpen] = useState(false);

  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const account = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return { email: data.user?.email ?? null };
    },
  });

  const newThread = useMutation({
    mutationFn: () => create({ data: undefined }),
    onSuccess: async (thread) => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
      onNavigate?.();
    },
    onError: () => toast.error("Could not start a new chat."),
  });

  const removeThread = useMutation({
    mutationFn: (threadId: string) => remove({ data: { threadId } }),
    onSuccess: async (_result, threadId) => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      if (threadId === activeId) navigate({ to: "/chat" });
    },
    onError: () => toast.error("Could not delete that chat."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    resetSession();
    await ensureSession();
    onNavigate?.();
    navigate({ to: "/chat", replace: true });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src={logo} alt="AozoraAi logo" width={28} height={28} className="h-7 w-7" />
        <span className="font-sans text-base font-semibold text-sidebar-foreground">AozoraAi</span>
      </div>

      <div className="px-3">
        <Button
          className="h-11 w-full justify-start gap-2 sm:h-10"
          onClick={() => newThread.mutate()}
          disabled={newThread.isPending}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <nav className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-2 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Conversations
        </p>
        <ul className="space-y-1">
          {threads.data?.map((thread) => (
            <li key={thread.id} className="group relative">
              <Link
                to="/chat/$threadId"
                params={{ threadId: thread.id }}
                onClick={() => onNavigate?.()}
                className={cn(
                  "block truncate rounded-lg py-2.5 pr-10 pl-3 text-sm transition-colors sm:py-2",
                  thread.id === activeId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {thread.title}
              </Link>
              <button
                type="button"
                aria-label={`Delete ${thread.title}`}
                onClick={() => removeThread.mutate(thread.id)}
                className="absolute top-1.5 right-1 rounded-md p-2 text-muted-foreground transition hover:text-destructive focus-visible:opacity-100 md:p-1.5 md:opacity-0 md:group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </button>
            </li>
          ))}
          {threads.data?.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No conversations yet.</li>
          )}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {account.data?.email ? (
          <>
            <p className="truncate px-3 pb-1 text-xs text-muted-foreground">{account.data.email}</p>
            <Button
              variant="ghost"
              className="h-11 w-full justify-start gap-2 sm:h-10"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="h-11 w-full justify-start gap-2 sm:h-10"
              onClick={() => setAccountOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Save your chats
            </Button>
            <p className="px-1 pt-2 text-xs text-muted-foreground">
              Add an email and password to reach these chats anywhere.
            </p>
          </>
        )}
      </div>

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}