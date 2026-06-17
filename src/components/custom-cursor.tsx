"use client";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CustomCursor() {
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const ringX = useSpring(dotX, { stiffness: 150, damping: 18 });
  const ringY = useSpring(dotY, { stiffness: 150, damping: 18 });
  const isPointerRef = useRef(false);

  useEffect(() => {
    // Only on desktop; skip if reduced-motion is preferred
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return; // touch devices

    function move(e: MouseEvent) {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
    }

    function onPointerEnter() { isPointerRef.current = true; }
    function onPointerLeave() { isPointerRef.current = false; }

    document.addEventListener("mousemove", move);
    document.querySelectorAll("a,button,[role=button]").forEach((el) => {
      el.addEventListener("mouseenter", onPointerEnter);
      el.addEventListener("mouseleave", onPointerLeave);
    });

    return () => {
      document.removeEventListener("mousemove", move);
    };
  }, [dotX, dotY]);

  return (
    <>
      {/* Dot — follows cursor exactly */}
      <motion.div
        className="pointer-events-none fixed z-[9999] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500"
        style={{ left: dotX, top: dotY }}
        aria-hidden="true"
      />
      {/* Ring — follows with spring lag */}
      <motion.div
        className="pointer-events-none fixed z-[9998] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-400/40"
        style={{ left: ringX, top: ringY }}
        aria-hidden="true"
      />
    </>
  );
}
