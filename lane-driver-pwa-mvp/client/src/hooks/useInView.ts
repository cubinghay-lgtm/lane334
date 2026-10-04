import { useEffect, useRef, useState } from "react";

/**
 * `active`: the card fills most of the feed viewport (plays video, runs timers).
 * `near`: within one screen, so heavy media can mount ahead of time.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(false);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const activeObserver = new IntersectionObserver(([entry]) => setActive(entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6, 1],
    });
    const nearObserver = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "100% 0px" });
    activeObserver.observe(element);
    nearObserver.observe(element);
    return () => {
      activeObserver.disconnect();
      nearObserver.disconnect();
    };
  }, []);

  return { ref, active, near };
}
