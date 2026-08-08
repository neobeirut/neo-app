import { useState, useEffect } from "react";

export function useHeroSlider() {
  const [sliderImages, setSliderImages] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoadingSlider, setIsLoadingSlider] = useState(true);

  useEffect(() => {
    fetchSliderImages();
  }, []);

  const fetchSliderImages = async () => {
    try {
      const response = await fetch("/api/settings/hero-slider");
      if (response.ok) {
        const data = await response.json();
        setSliderImages(data.images || []);
      }
    } catch (error) {
      console.error("Error fetching slider images:", error);
    } finally {
      setIsLoadingSlider(false);
    }
  };

  useEffect(() => {
    if (sliderImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [sliderImages.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + sliderImages.length) % sliderImages.length,
    );
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return {
    sliderImages,
    currentSlide,
    isLoadingSlider,
    nextSlide,
    prevSlide,
    goToSlide,
  };
}

export default useHeroSlider;
