# AozoraAi — AI chat platform

A dark, sleek AI assistant with threaded conversations, accounts, image attachments, web search, and image generation.

## What gets built

**Auth & accounts**
- Email/password + Google sign-in (Lovable Cloud).
- Public landing page at `/` with the AozoraAi brand, positioning, and a sign-in CTA.
- `/auth` page (sign in / sign up). Signed-in home is the chat app.
- Profiles table for display name + avatar, created automatically on signup.

**Threaded chat**
- Sidebar with conversation history: new chat, rename, delete, search.
- Each thread has its own URL (`/chat/$threadId`); reloading restores that thread's messages.
- Messages persist in the cloud database, scoped to the signed-in user.
- Streaming assistant replies with markdown, code blocks, copy/regenerate actions, stop button, and a "Thinking…" indicator.

**Capabilities**
- Image attachments: upload images in the composer and ask about them (stored in cloud storage, sent to the model as vision input).
- Web search tool: the assistant can search the web and show collapsible sources/citations.
- Image generation tool: ask for an image and it streams into the chat, saved with the message.
- Tool activity renders as collapsed cards showing tool name, status, and a compact result.

**Design — dark, sleek, modern**
- Near-black layered surfaces, luminous sky-blue accent (the "aozora" idea), subtle glow on focus and the send button.
- Generated AozoraAi logo mark used in the header, empty state, and favicon area.
- Assistant messages plain on the surface, user messages in a high-contrast blue bubble.
- Responsive: collapsible sidebar sheet on mobile.

## Technical notes

- Lovable Cloud enabled for auth, Postgres, and storage.
- Tables: `profiles`, `threads`, `messages` (stores AI SDK `UIMessage` parts as JSONB), plus a private storage bucket for attachments. RLS + grants scope every row to `auth.uid()`.
- Chat streaming through a server route at `/api/chat` using the AI SDK with Lovable AI (`openai/gpt-5.6-sol`); thread ownership verified server-side, user + assistant messages saved on finish.
- Image generation via a separate streaming server route so partial previews arrive progressively.
- Chat UI composed from AI Elements primitives (conversation, message, prompt-input, tool, shimmer) styled to the dark theme.
- Protected routes live under `_authenticated`; the landing page stays public with its own SEO head tags.

## Build order

1. Enable Cloud, migrations (profiles/threads/messages + storage bucket, RLS, grants), auth pages.
2. Design system tokens + logo, landing page.
3. Chat server route, thread routes, sidebar + chat UI with persistence.
4. Attachments, web search tool, image generation tool.
5. Verify: create two threads, send messages in each, reload, confirm history and each capability.
