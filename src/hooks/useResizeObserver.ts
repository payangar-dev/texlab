import { useEffect } from "react";
import { useViewportStore } from "../store/viewportStore";

export function useResizeObserver(
  containerRef: React.RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const setContainerSize = useViewportStore.getState().setContainerSize;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize(width, height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);
}
