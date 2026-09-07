"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { signIn, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BookOpen, FileText, Globe, Film, Send, Sparkles } from "lucide-react";

const capabilities = [
  "PDFs, web pages, YouTube, Markdown, and plain text",
  "Answers cite the exact passages they came from",
  "Chunk-level inspection of everything you add",
  "Web search when your sources don't cover it",
];

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  const handleGoogleSignIn = async () => {
    const clientOrigin = window.location.origin;
    await signIn.social({
      provider: "google",
      callbackURL: `${clientOrigin}/dashboard`,
    });
  };

  if (isPending) {
    return <PageLoader />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
              <BookOpen className="size-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">NotebookLM</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleGoogleSignIn}>
              Sign in
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14 lg:py-24">
          <div>
            <h1 className="max-w-lg text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
              A research notebook that answers from your own sources
            </h1>

            <p className="mt-5 max-w-md text-[15px]/relaxed text-muted-foreground">
              Collect documents, links, and transcripts in one place. Ask questions
              and get answers grounded in that material, with citations pointing back
              to the passage they came from.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-10 px-4" onClick={handleGoogleSignIn}>
                <GoogleMark />
                Continue with Google
              </Button>
              <span className="text-xs text-muted-foreground">
                Free to start · No credit card
              </span>
            </div>

            <ul className="mt-10 grid gap-2.5 border-t pt-8">
              {capabilities.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/60"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <ProductPreview />
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <p className="text-xs text-muted-foreground">
            NotebookLM — grounded answers from your own material.
          </p>
          <p className="text-xs text-muted-foreground">Built with Next.js</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * A static, non-interactive miniature of the workspace. Showing the actual
 * product beats describing it, and keeps the page from reading as a template.
 */
function ProductPreview() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl border bg-card shadow-sm select-none"
    >
      {/* Window chrome */}
      <div className="flex h-9 items-center gap-2 border-b bg-muted/40 px-3">
        <span className="flex gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/25" />
          <span className="size-2 rounded-full bg-muted-foreground/25" />
          <span className="size-2 rounded-full bg-muted-foreground/25" />
        </span>
        <span className="ml-1.5 text-[11px] text-muted-foreground">
          Thesis research
        </span>
      </div>

      <div className="grid grid-cols-[132px_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="space-y-3 border-r bg-sidebar/60 p-3">
          <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
            Sources
          </p>
          <div className="space-y-2">
            {[
              { icon: FileText, label: "Interview notes" },
              { icon: Globe, label: "Field study" },
              { icon: Film, label: "Lecture 04" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted">
                  <Icon className="size-2.5 text-muted-foreground" />
                </span>
                <span className="truncate text-[10px] text-foreground/70">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3">
            <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
              Chats
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="rounded bg-primary/10 px-1.5 py-1 text-[10px] text-foreground/80">
                Key findings
              </div>
              <div className="px-1.5 text-[10px] text-muted-foreground">
                Methodology
              </div>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="flex min-h-64 flex-col justify-between p-3.5">
          <div className="space-y-3">
            {/* User */}
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-lg bg-primary px-2.5 py-1.5 text-[10px] leading-relaxed text-primary-foreground">
                What do the interviews say about onboarding friction?
              </div>
            </div>

            {/* Assistant */}
            <div className="flex gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-primary/10">
                <Sparkles className="size-2.5 text-primary" />
              </span>
              <div className="min-w-0 flex-1 rounded-lg border bg-muted/40 px-2.5 py-2">
                <p className="text-[10px] leading-relaxed text-foreground/80">
                  Three participants described the first-run setup as the main
                  drop-off point, citing unclear next steps after account creation.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-1.5">
                  <span className="rounded bg-background px-1 py-px text-[8px] font-medium text-muted-foreground ring-1 ring-border">
                    1 Interview notes
                  </span>
                  <span className="rounded bg-background px-1 py-px text-[8px] font-medium text-muted-foreground ring-1 ring-border">
                    2 Field study
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="mt-4 flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5">
            <span className="flex-1 truncate text-[10px] text-muted-foreground">
              Ask a follow-up…
            </span>
            <span className="flex size-4 items-center justify-center rounded bg-primary">
              <Send className="size-2 text-primary-foreground" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
