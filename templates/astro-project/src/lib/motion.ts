/*
 * The Tier-0 / Tier-1 motion entry (see references/motion-and-3d.md).
 *
 * Activates `gsap` + `lenis` (already in package.json) as the project's motion
 * floor: Lenis smooth scroll on ONE RAF loop, GSAP ScrollTrigger reveals keyed on
 * `data-animate` (the same attribute the reference-capture engine recognises, so
 * captured and built sites speak one dialect), and the View-Transitions refresh
 * bridge.
 *
 * THE ONE LAW: this whole module early-returns under prefers-reduced-motion. The
 * global CSS switch in globals.css neutralises CSS animation but CANNOT stop a
 * Lenis RAF loop or a GSAP timeline, so the JS guard is mandatory, not optional.
 *
 * Tier 2 (the optional R3F island, components/ThreeScene.tsx) is NOT wired here -
 * it is opt-in per build so the default template never ships a WebGL bundle.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let lenis: Lenis | null = null;
let booted = false;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Recipe 4 - Lenis smooth scroll, the one mandatory singleton.
 * One RAF: Lenis is driven from gsap.ticker, not its own autoRaf loop.
 */
function bootLenis() {
  lenis = new Lenis({ autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/**
 * Recipe 5 (JS fallback) - reveal-on-scroll for any [data-animate] element.
 * The CSS scroll-driven version (animation-timeline: view()) is preferred and
 * runs with zero JS where supported; this is the ScrollTrigger fallback for the
 * elements that need it.
 */
function revealOnScroll() {
  const els = gsap.utils.toArray<HTMLElement>("[data-animate]");
  els.forEach((el) => {
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 24 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      },
    );
  });
}

/**
 * Recipe 3 - GSAP ScrollTrigger pin/scrub, for any [data-pin] section.
 * Transforms only; never created under reduced motion (the whole module returns
 * early). invalidateOnRefresh so it survives a View-Transition swap.
 */
function pinnedScroll() {
  const pins = gsap.utils.toArray<HTMLElement>("[data-pin]");
  pins.forEach((el) => {
    gsap.to(el.querySelectorAll<HTMLElement>("[data-pin-item]"), {
      yPercent: -100,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        pin: true,
        scrub: true,
        start: "top top",
        end: "+=100%",
        invalidateOnRefresh: true,
      },
    });
  });
}

/**
 * Recipe 7 (parallax variant) - light parallax for any [data-parallax] element,
 * transform-only, scrubbed.
 */
function parallax() {
  const els = gsap.utils.toArray<HTMLElement>("[data-parallax]");
  els.forEach((el) => {
    const depth = Number(el.dataset.parallax || "0.2");
    gsap.to(el, {
      yPercent: -depth * 100,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        scrub: true,
        start: "top bottom",
        end: "bottom top",
        invalidateOnRefresh: true,
      },
    });
  });
}

/**
 * initMotion - the single entry. Call once. Honours reduced motion (early
 * return), boots the singletons and the named recipes, and re-arms after a
 * View-Transition swap.
 */
export function initMotion() {
  if (booted) return;
  if (prefersReducedMotion()) return; // THE ONE LAW: no JS motion under reduced motion.
  booted = true;

  gsap.registerPlugin(ScrollTrigger);
  bootLenis();
  revealOnScroll();
  pinnedScroll();
  parallax();

  // View Transitions (Recipe 6): re-measure triggers and reset scroll on swap.
  document.addEventListener("astro:after-swap", () => {
    ScrollTrigger.refresh();
    lenis?.scrollTo(0, { immediate: true });
  });
}
