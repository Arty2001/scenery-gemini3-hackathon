"use client";

import { motion } from "motion/react";
import { fadeInUp } from "@/components/landing/scroll-animations";

export function DemoSection() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.h2
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="text-3xl sm:text-4xl font-bold tracking-tight text-white text-center mb-4"
        >
          How it works
        </motion.h2>
        <motion.p
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="text-zinc-500 text-center mb-16 max-w-lg mx-auto"
        >
          Your code is the single source of truth. Scenery treats every React component as a video asset.
        </motion.p>

        <div className="space-y-16">
          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-start gap-5">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm font-semibold text-indigo-400">
                1
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Connect your GitHub repo
                </h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Scenery scans your repository and discovers every exported React component automatically.
                </p>
                {/* Code mockup */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-zinc-600">{"// your-repo/components/hero.tsx"}</div>
                  <div className="mt-1">
                    <span className="text-purple-400">export default</span>
                    <span className="text-blue-400"> function </span>
                    <span className="text-yellow-300">Hero</span>
                    <span className="text-zinc-400">{"() {"}</span>
                  </div>
                  <div className="text-zinc-500 pl-4">{"return <div className=\"...\">...</div>"}</div>
                  <div className="text-zinc-400">{"}"}</div>
                  <div className="mt-3 text-emerald-400/70 text-xs">{"✓ Discovered: <Hero />, <Card />, <Chart />, <Pricing />"}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex items-start gap-5">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm font-semibold text-indigo-400">
                2
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Tell Gemini 3 what to make
                </h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Describe your video in plain language. Gemini 3 places your components on the timeline, adds transitions, and generates voiceover.
                </p>
                {/* Chat mockup */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 flex-shrink-0">You</div>
                    <p className="text-zinc-300">{'"Make a 30-second product demo. Start with the Hero, then show the Pricing card, and end with a call to action."'}</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                    </div>
                    <p className="text-zinc-400">{"Done — placed 3 components on the timeline with fade transitions and narration. Preview is ready."}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-start gap-5">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm font-semibold text-indigo-400">
                3
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Preview and export
                </h3>
                <p className="text-sm text-zinc-500">
                  Watch the video in the real-time Remotion player. Tweak timing on the timeline. Export to MP4 with one click.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
