import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, ImagePlus, MessagesSquare, ScanEye } from "lucide-react";

import logo from "@/assets/aozora-logo.png";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AozoraAi — Chat with an open-sky AI" },
      {
        name: "description",
        content:
          "AozoraAi is an AI assistant with threaded conversations, live web search, image understanding and image generation. Start chatting free.",
      },
      { property: "og:title", content: "AozoraAi — Chat with an open-sky AI" },
      {
        property: "og:description",
        content:
          "Threaded conversations, live web search, vision and image generation in one calm blue interface.",
      },
    ],
  }),
  component: Landing,
});

const capabilities = [
  {
    icon: MessagesSquare,
    title: "Threaded memory",
    body: "Every conversation lives at its own URL and is saved automatically — no sign-up needed.",
  },
  {
    icon: Globe,
    title: "Live web search",
    body: "AozoraAi looks things up when it matters and cites what it read.",
  },
  {
    icon: ScanEye,
    title: "Reads your images",
    body: "Attach screenshots, diagrams or photos and ask questions about them.",
  },
  {
    icon: ImagePlus,
    title: "Makes images",
    body: "Describe a visual and get an original generated image right in the thread.",
  },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-64 h-[36rem] opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(45% 55% at 50% 50%, oklch(0.68 0.18 247 / 0.55), transparent 70%)",
        }}
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={logo}
            alt="AozoraAi logo"
            width={32}
            height={32}
            className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
          />
          <span className="truncate font-sans text-base font-semibold tracking-tight sm:text-lg">
            AozoraAi
          </span>
        </div>
        <Button asChild variant="ghost" className="shrink-0">
          <Link to="/chat">Open chat</Link>
        </Button>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <section className="pt-10 pb-16 text-center sm:pt-24 sm:pb-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[0.7rem] text-muted-foreground sm:px-4 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Powered by frontier reasoning models
          </p>
          <h1 className="mx-auto max-w-3xl text-[clamp(2.25rem,10vw,3.75rem)] leading-[1.05] font-semibold text-balance">
            An AI that thinks in <span className="aozora-gradient-text">open sky</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground sm:mt-6 sm:text-lg">
            AozoraAi answers hard questions, searches the live web, understands the images you
            share, and paints new ones — all in one calm, fast workspace.
          </p>
          <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="aozora-glow w-full sm:w-auto">
              <Link to="/chat">Start chatting free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/chat">Open AozoraAi</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border border-border bg-card/70 p-5 transition-colors hover:border-primary/40 sm:p-6"
            >
              <Icon className="mb-4 h-5 w-5 text-primary" aria-hidden />
              <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="relative border-t border-border px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
        AozoraAi · 青空 · built for clear thinking
      </footer>
    </div>
  );
}
