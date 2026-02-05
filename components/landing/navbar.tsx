"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-black/80 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <nav className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold text-white">
          Scenery
        </Link>

        <Link
          href="/protected"
          className="text-sm bg-white text-black px-4 py-1.5 rounded-full font-medium hover:bg-zinc-200 transition-colors"
        >
          Open Editor
        </Link>
      </nav>
    </header>
  );
}
