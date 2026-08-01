import { ThreadList } from "@/components/chat/ThreadList";

export function ThreadSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <ThreadList />
    </aside>
  );
}