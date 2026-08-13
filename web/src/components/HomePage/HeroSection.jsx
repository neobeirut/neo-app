import { ChevronRight, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { openOrderApp } from "@/utils/deviceDetection";

export function HeroSection({ sliderData }) {
  const { sliderImages, currentSlide, nextSlide, prevSlide, goToSlide } =
    sliderData;
  const [isLoaded, setIsLoaded] = useState(false);

  // Default fallback image if no slider images
  const defaultImage = "https://app.neobeirut.com/website/home-page-branch.jpg";
  const hasSliderImages = sliderImages && sliderImages.length > 0;
  const currentImage = hasSliderImages ? sliderImages[currentSlide] : null;

  // Fade in the first image smoothly on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <div className="absolute inset-0">
        <img
          src={currentImage?.url || defaultImage}
          alt={currentImage?.title || "Background"}
          className="w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Navigation arrows - only show if multiple images */}
      {hasSliderImages && sliderImages.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all"
            aria-label="Previous slide"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all"
            aria-label="Next slide"
          >
            <ChevronRight size={32} />
          </button>

          {/* Slide indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {sliderImages.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentSlide
                    ? "bg-white w-8"
                    : "bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        <div className="overflow-hidden mb-8">
          {/* Show custom title if available, otherwise default */}
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-4 drop-shadow-lg">
            {currentImage?.title || "NEO BEIRUT"}
          </h1>
          {/* Show custom subtitle if available, otherwise default */}
          <p className="text-xl md:text-2xl text-white mb-8 drop-shadow-md">
            {currentImage?.subtitle || "Flavors Worth Savoring"}
          </p>
        </div>
        <button
          onClick={(e) => openOrderApp(e)}
          className="inline-flex items-center gap-2 px-8 py-4 bg-[#2D5F5D] text-white font-semibold hover:bg-[#1f4342] transition-all rounded-lg shadow-lg hover:shadow-xl cursor-pointer"
        >
          Explore Our Menu
          <ChevronRight size={24} />
        </button>
      </div>
    </section>
  );
}
