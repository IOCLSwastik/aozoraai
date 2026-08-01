# Fix image enhancement, real PDF files, and mobile chat history

## 1. Enhance / edit an image you attach

Today AozoraAi can *look* at an image you attach, but it has no way to produce a changed
version of it — the only image tool it has creates a brand new picture from a text
description and never sees your upload. So "enhance this" comes back as words, not a
new image.

Fix: give the assistant a real image-editing capability.

- New `edit_image` tool that receives the image you attached in the current message plus
  your instruction ("enhance", "brighten", "remove the background", "make it a poster"),
  and returns the edited image.
- The attached image is passed through to the tool automatically, so you never have to
  paste a URL.
- Assistant instructions updated: when the user attaches an image and asks for any visual
  change, call `edit_image`; only use `generate_image` when there is no source image.
- The edited image renders inline in the reply the same way generated images do, with a
  download link.
- If the model refuses or fails, the reply says so plainly instead of silently describing
  the image.

## 2. "Make a PDF" produces an actual .pdf

Right now nothing in the app can build a file, so the model falls back to writing HTML in
the chat.

Fix: a `create_pdf` tool that produces a genuine PDF document.

- The assistant passes a title and the document content; the server renders a real,
  paginated PDF (cover title, headings, paragraphs, bullet lists, page numbers).
- The file is saved to your private storage under your own account and returned as a
  time-limited download link.
- The chat shows a PDF card with the filename and a Download button.
- Assistant instructions updated: any request for a PDF, report, resume, invoice,
  handout, or "document I can download" must use `create_pdf` — never HTML, never a
  fenced code block pretending to be a file.

## 3. Chat history on mobile

The mobile drawer exists behind the hamburger icon but is easy to miss, and nothing on
screen says "history".

- Replace the bare hamburger with a clearly labelled history control (icon + "Chats")
  in the mobile top bar.
- Show the conversation list immediately when you land on `/chat` on a phone if there is
  history, so past chats are visible without opening anything.
- Drawer polish: it becomes scrollable at small heights, closes on selection, and keeps
  the New chat button reachable above the keyboard/safe area.
- Verified on a real phone-sized viewport before finishing.

## Technical notes

- `src/lib/ai-tools.server.ts`: add `createImageEditTool(apiKey, sourceImages)` posting to
  the Lovable AI image endpoint with a Gemini image model using the `messages` +
  `modalities` body, including an `image_url` block for the source image (data URL or
  signed URL). Add `createPdfTool(supabase, userId)` using `pdf-lib` (pure JS, runs in the
  Worker runtime) with `StandardFonts.Helvetica`, uploading to the existing
  `chat-attachments` bucket at `${userId}/documents/<uuid>.pdf` and returning a signed URL.
- `src/routes/api/chat.ts`: extract image parts from the last user message and pass them
  into `edit_image`; register both new tools; extend `SYSTEM_PROMPT` with the image-edit
  and PDF rules.
- `src/components/chat/ChatWindow.tsx`: render `tool-edit_image` like `tool-generate_image`
  (inline image + download) and `tool-create_pdf` as a file card with filename, size and
  Download button.
- `src/components/chat/ChatTopBar.tsx` / `ThreadList.tsx`: labelled history trigger,
  scroll and safe-area fixes.
- `src/routes/chat.index.tsx`: on small screens show the thread list when history exists
  instead of jumping straight into an empty new chat.
- Install `pdf-lib`. Verify with a typecheck plus a Playwright pass at 390x800 covering
  history, an image edit, and a PDF download.
