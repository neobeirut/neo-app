import { useRef, useCallback, useEffect } from "react";
import { useBottomBarStore } from "../utils/bottomBarStore";

/**
 * Hook to attach to a ScrollView's onScroll property.
 * Hides the bottom navigation bar when scrolling down and shows it when scrolling up.
 */
export function useScrollHandler() {
  const lastY = useRef(0);
  const setVisible = useBottomBarStore((state) => state.setVisible);

  useEffect(() => {
    // Reset bottom bar to visible when the screen using this hook mounts
    setVisible(true);
  }, [setVisible]);

  const handleScroll = useCallback(
    (event) => {
      const currentY = event.nativeEvent.contentOffset.y;

      // If we scroll to the very top (or negative due to bounce), make sure it is visible
      if (currentY <= 15) {
        setVisible(true);
        lastY.current = currentY;
        return;
      }

      const diff = currentY - lastY.current;

      // Only toggle if the scroll distance is meaningful to avoid flickering/jitter
      if (diff > 15) {
        setVisible(false); // scrolling down
      } else if (diff < -15) {
        setVisible(true); // scrolling up
      }

      lastY.current = currentY;
    },
    [setVisible],
  );

  return handleScroll;
}
