import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/aozora-logo.png";
import { Button } from "@/components/ui/button";
import { createThread, deleteThread, listThreads } from "@/lib/threads.functions";
import { cn } from "@/lib/utils";

export function ThreadSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const newThread = useMutation({
    mutationFn: () => create({ data: undefined }),
    onSuccess: async (thread) => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
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

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src={logo} alt="AozoraAi logo" width={28} height={28} className="h-7 w-7" />
        <span className="font-sans text-base font-semibold text-sidebar-foreground">AozoraAi</span>
      </div>

      <div className="px-3">
        <Button
          className="w-full justify-start gap-2"
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
                className={cn(
                  "block truncate rounded-lg py-2 pr-9 pl-3 text-sm transition-colors",
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
                className="absolute top-1.5 right-1 rounded-md p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {threads.data?.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No conversations yet.</li>
          )}
        </ul>
      </nav>

    </aside>
  );
}
