import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-zinc-600">
          &copy; 2026 Scenery
        </p>
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
