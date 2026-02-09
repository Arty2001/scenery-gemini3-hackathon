"use client";

import { motion } from "motion/react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/30 via-black to-black" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/8 blur-[180px] pointer-events-none" />

      <motion.div
        className="relative z-10 max-w-4xl text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Gemini badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-400 mb-8">
          <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
          Built with Gemini 3
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
          Connect your repo.
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Components become video.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Scenery pulls your React components from GitHub and turns them into video assets.
          Tell Gemini 3 what to build — it arranges your components on a timeline, adds voiceover, and exports MP4.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/protected"
            className="rounded-full bg-white text-black font-semibold px-8 py-3 text-base hover:bg-zinc-200 transition-colors"
          >
            Try Demo
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-white/15 text-white font-medium px-8 py-3 text-base hover:bg-white/5 transition-colors"
          >
            How It Works
          </a>
        </div>
      </motion.div>

      {/* Visual concept: code → video flow */}
      <motion.div
        className="relative z-10 mt-16 w-full max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          {/* GitHub box */}
          <div className="flex-1 max-w-[200px] rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
            <svg className="w-8 h-8 mx-auto text-zinc-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-zinc-500 font-medium">Your GitHub Repo</p>
            <p className="text-[11px] text-zinc-600 mt-1 font-mono">&lt;Chart /&gt; &lt;Card /&gt;</p>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
            <span className="text-[10px] text-indigo-400/60 font-medium">Gemini 3</span>
          </div>

          {/* Scenery editor box */}
          <div className="flex-1 max-w-[200px] rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
            <svg className="w-8 h-8 mx-auto text-zinc-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <p className="text-xs text-zinc-500 font-medium">Video Timeline</p>
            <p className="text-[11px] text-zinc-600 mt-1">Components as assets</p>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
            <span className="text-[10px] text-indigo-400/60 font-medium">Export</span>
          </div>

          {/* MP4 box */}
          <div className="flex-1 max-w-[200px] rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
            <svg className="w-8 h-8 mx-auto text-zinc-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <p className="text-xs text-zinc-500 font-medium">MP4 Video</p>
            <p className="text-[11px] text-zinc-600 mt-1">Production-ready</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
