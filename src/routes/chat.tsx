import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ChatTopBar } from "@/components/chat/ChatTopBar";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { ensureSession } from "@/lib/session";

export const Route = createFileRoute("/chat")({
  ssr: false,
  beforeLoad: async () => {
    await ensureSession();
  },
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <ThreadSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatTopBar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
