import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/scenery-logo.png"
            alt="Scenery"
            width={80}
            height={28}
            className="h-6 w-auto opacity-60"
          />
          <span className="text-sm text-zinc-600">&copy; 2026</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-600">
          <span>Powered by Gemini 3</span>
          <Link
            href="https://github.com"
            className="hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
