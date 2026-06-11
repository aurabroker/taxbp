import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        malina: { DEFAULT: "#D81B60", dark: "#AD1457", soft: "#FCE4EC" },
        blush: "#FDF4F7",
        ink: { DEFAULT: "#222A45", soft: "#5B6478" },
        gold: "#C8963E",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(216, 27, 96, 0.18)",
        soft: "0 4px 24px -8px rgba(34, 42, 69, 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
