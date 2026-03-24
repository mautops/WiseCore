import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hi-Ops — DevOps Platform",
  description:
    "Modern infrastructure management platform. AI-powered automation and unified access control for your DevOps workflows.",
};

const features = [
  {
    icon: "🤖",
    title: "AI Agent",
    subtitle: "智能体",
    description:
      "Intelligent operations assistant with automated troubleshooting and decision support.",
  },
  {
    icon: "📊",
    title: "Overview",
    subtitle: "概览",
    description:
      "Real-time monitoring of all infrastructure and service health at a glance.",
  },
  {
    icon: "🖥️",
    title: "Virtual Machine",
    subtitle: "虚拟机",
    description:
      "Self-service VM provisioning and lifecycle management with one-click deployment.",
  },
  {
    icon: "🔐",
    title: "Bastion Host",
    subtitle: "堡垒机",
    description:
      "Secure access gateway with full audit trail for all server operations.",
  },
];

export default function LandingPage() {
  return (
    <div
      className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-8 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">🦀</span>
          <span className="font-mono text-base font-bold tracking-tight">
            Hi-Ops
          </span>
          <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            v1.0
          </span>
        </div>
        <Link
          href="/login"
          className="rounded border border-zinc-700 bg-zinc-900 px-4 py-1.5 font-mono text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
        >
          Login →
        </Link>
      </header>

      <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="relative mb-8">
          <div
            className="absolute inset-0 -m-12 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(249,115,22,0.15), transparent 70%)",
            }}
          />
          <span className="relative text-8xl leading-none" aria-hidden>
            🦀
          </span>
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 font-mono text-xs text-zinc-400">
          <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
          DevOps Platform
        </div>

        <h1 className="mt-2 font-mono text-7xl font-black tracking-tighter text-zinc-50">
          Hi<span className="text-orange-500">-</span>Ops
        </h1>

        <p className="mt-5 max-w-sm text-sm leading-relaxed text-zinc-400">
          Modern infrastructure management platform. Streamline DevOps workflows
          with AI automation and unified access control.
        </p>

        <div className="mt-10 flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-orange-500 px-8 py-2.5 font-mono text-sm font-bold text-white transition-colors hover:bg-orange-400"
          >
            Get Started →
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-700 px-8 py-2.5 font-mono text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            Login
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-8 pb-20">
        <p className="mb-8 text-center font-mono text-[11px] uppercase tracking-widest text-zinc-600">
          Core Capabilities
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-zinc-700"
            >
              <span className="text-3xl leading-none">{f.icon}</span>
              <p className="mt-3 font-mono text-sm font-semibold text-zinc-200">
                {f.title}
              </p>
              <p className="text-[11px] text-zinc-600">{f.subtitle}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 px-8 py-4 text-center">
        <p className="font-mono text-xs text-zinc-700">
          Hi-Ops · Internal DevOps Platform
        </p>
      </footer>
    </div>
  );
}
