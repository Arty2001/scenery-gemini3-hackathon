"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/components/landing/scroll-animations";

const features = [
  {
    title: "Code-First Videos",
    description: "Your React components are the video assets. Write code, get video.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: "Gemini AI Director",
    description: "Describe what you want. Gemini 3 composes scenes, places assets, adds narration.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
    ),
  },
  {
    title: "Instant Preview & Export",
    description: "Real-time Remotion player preview. One-click MP4 export via Lambda.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
    ),
  },
];

export function FeatureSection() {
  return (
    <section className="py-24 px-6">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
        className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            variants={staggerItem}
            className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5"
          >
            <div className="text-indigo-400 mb-3">{feature.icon}</div>
            <h3 className="text-base font-semibold text-white mb-1">
              {feature.title}
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
