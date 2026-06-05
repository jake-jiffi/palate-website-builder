import type { Config } from "tailwindcss";
import brandPreset from "@jiffi-projects/{{SLUG}}-brand/tailwind.preset";

export default {
  presets: [brandPreset],
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
} satisfies Config;
