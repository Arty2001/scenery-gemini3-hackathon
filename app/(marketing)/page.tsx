import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { FeatureSection } from "@/components/landing/feature-section";
import { DemoSection } from "@/components/landing/demo-section";
import { CTASection } from "@/components/landing/cta-section";

export default function LandingPage() {
  return (
    <div className="scroll-smooth">
      <Navbar />

      <main>
        <HeroSection />
        <FeatureSection />
        <DemoSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
