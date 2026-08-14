"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/HomePage/Header";
import { HeroSection } from "@/components/HomePage/HeroSection";
import { FeaturedSection } from "@/components/HomePage/FeaturedSection";
import { ProductsSection } from "@/components/HomePage/ProductsSection";
import { MenuSection } from "@/components/HomePage/MenuSection";
import { CateringSection } from "@/components/HomePage/CateringSection";
import { ExperienceSection } from "@/components/HomePage/ExperienceSection";
import { AboutSection } from "@/components/HomePage/AboutSection";
import { TestimonialsSection } from "@/components/HomePage/TestimonialsSection";
import { ContactSection } from "@/components/HomePage/ContactSection";
import { Footer } from "@/components/HomePage/Footer";

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    document.title = "Neo Beirut | Artisanal Pastry, Bakery & Bistro";
  }, []);

  const scrollToSection = (id) => {
    if (typeof window === "undefined") return;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const sliderData = {
    sliderImages: [],
    currentSlide,
    nextSlide: () => setCurrentSlide((prev) => prev + 1),
    prevSlide: () => setCurrentSlide((prev) => Math.max(0, prev - 1)),
    goToSlide: (index) => setCurrentSlide(index),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#2D5F5D] selection:text-white">
      <Header scrollToSection={scrollToSection} />
      <main>
        <HeroSection sliderData={sliderData} />
        <FeaturedSection />
        <ProductsSection />
        <MenuSection />
        <CateringSection />
        <ExperienceSection />
        <AboutSection />
        <TestimonialsSection />
        <ContactSection />
      </main>
      <Footer scrollToSection={scrollToSection} />
    </div>
  );
}

