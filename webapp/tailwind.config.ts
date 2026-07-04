import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0a0e14",
        panel: "#0f141d",
        panel2: "#141b26",
        border: "#232c3a",
        accent: "#f2a341",
        accent2: "#4fd1c5",
        text: "#e7ecf3",
        muted: "#8a94a6",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(242,163,65,0.25), 0 8px 30px rgba(242,163,65,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
