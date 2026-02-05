import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scenery - AI-Powered Video Creation",
  description:
    "Create stunning videos with your React components. AI-powered editing, real-time collaboration, and code as the single source of truth.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      {children}
    </div>
  );
}
