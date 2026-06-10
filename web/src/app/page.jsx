"use client";

import { useEffect } from "react";
import { useHeroSlider } from "@/hooks/useHeroSlider";
import { scrollToSection } from "@/utils/scrollHelpers";
import { Header } from "@/components/HomePage/Header";
import { HeroSection } from "@/components/HomePage/HeroSection";
import { FeaturedSection } from "@/components/HomePage/FeaturedSection";
import { AboutSection } from "@/components/HomePage/AboutSection";
import { CateringSection } from "@/components/HomePage/CateringSection";
import { MenuSection } from "@/components/HomePage/MenuSection";
import { ExperienceSection } from "@/components/HomePage/ExperienceSection";
import { TestimonialsSection } from "@/components/HomePage/TestimonialsSection";
import { ContactSection } from "@/components/HomePage/ContactSection";
import { Footer } from "@/components/HomePage/Footer";

export default function HomePage() {
  const sliderData = useHeroSlider();

  useEffect(() => {
    document.title = "Néo Beirut";
  }, []);

  return (
    <div className="bg-white text-gray-900 min-h-screen font-sans">
      <Header scrollToSection={scrollToSection} />
      <HeroSection sliderData={sliderData} />
      <FeaturedSection />
      <AboutSection />
      <CateringSection />
      <MenuSection />
      <ExperienceSection />
      <TestimonialsSection />
      <ContactSection />
      <Footer scrollToSection={scrollToSection} />
    </div>
  );
}
