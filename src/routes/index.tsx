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
    body: "Every conversation lives at its own URL and syncs to your account across devices.",
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

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AozoraAi logo" width={32} height={32} className="h-8 w-8" />
          <span className="font-sans text-lg font-semibold tracking-tight">AozoraAi</span>
        </div>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-6 pb-24">
        <section className="pt-16 pb-24 text-center sm:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Powered by frontier reasoning models
          </p>
          <h1 className="mx-auto max-w-3xl text-5xl leading-[1.05] font-semibold sm:text-6xl">
            An AI that thinks in <span className="aozora-gradient-text">open sky</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            AozoraAi answers hard questions, searches the live web, understands the images you
            share, and paints new ones — all in one calm, fast workspace.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="aozora-glow">
              <Link to="/auth">Start chatting free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/chat">Open AozoraAi</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border border-border bg-card/70 p-6 transition-colors hover:border-primary/40"
            >
              <Icon className="mb-4 h-5 w-5 text-primary" aria-hidden />
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="relative border-t border-border py-8 text-center text-xs text-muted-foreground">
        AozoraAi · 青空 · built for clear thinking
      </footer>
    </div>
  );
}
