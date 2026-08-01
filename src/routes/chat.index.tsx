import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { createThread, listThreads } from "@/lib/threads.functions";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createThread);
  const list = useServerFn(listThreads);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const threads = await list();
        const existing = threads[0];
        if (existing) {
          navigate({
            to: "/chat/$threadId",
            params: { threadId: existing.id },
            replace: true,
          });
          return;
        }
        const thread = await create({ data: undefined });
        await queryClient.invalidateQueries({ queryKey: ["threads"] });
        navigate({ to: "/chat/$threadId", params: { threadId: thread.id }, replace: true });
      } catch (error) {
        console.error(error);
        toast.error("Could not open your conversations.");
      }
    })();
  }, [create, list, navigate, queryClient]);

  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <Spinner />
    </div>
  );
}
