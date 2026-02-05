"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { fadeInUp } from "@/components/landing/scroll-animations";

export function CTASection() {
  return (
    <section className="relative py-24 px-6">
      {/* Subtle glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={fadeInUp}
        className="relative max-w-md mx-auto text-center"
      >
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
          Try it now
        </h2>
        <p className="text-zinc-500 mb-8">
          No sign-up required. Jump straight in.
        </p>
        <Link
          href="/protected"
          className="inline-flex items-center justify-center rounded-full bg-white text-black font-semibold px-8 py-3 text-base hover:bg-zinc-200 transition-colors"
        >
          Open Editor
        </Link>
      </motion.div>
    </section>
  );
}
