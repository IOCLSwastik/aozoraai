import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import logo from "@/assets/aozora-logo.png";
import { ThreadList } from "@/components/chat/ThreadList";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { createThread, listThreads } from "@/lib/threads.functions";

export function ChatTopBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);

  const threads = useQuery({ queryKey: ["threads"], queryFn: () => list() });
  const title = threads.data?.find((thread) => thread.id === params.threadId)?.title ?? "AozoraAi";

  const newThread = useMutation({
    mutationFn: () => create({ data: undefined }),
    onSuccess: async (thread) => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
    },
    onError: () => toast.error("Could not start a new chat."),
  });

  return (
    <header className="flex items-center gap-1 border-b border-border px-2 py-2 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open conversations">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] max-w-80 bg-sidebar p-0">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <ThreadList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Link to="/chat" className="flex min-w-0 flex-1 items-center gap-2">
        <img src={logo} alt="" width={20} height={20} className="h-5 w-5 shrink-0" />
        <span className="truncate text-sm font-medium">{title}</span>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        aria-label="New chat"
        onClick={() => newThread.mutate()}
        disabled={newThread.isPending}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </header>
  );
}