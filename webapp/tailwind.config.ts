import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0b0e13",
        panel: "#10141b",
        panel2: "#161b24",
        border: "#29303d",
        accent: "#35e0d0",   // 亮青绿：主操作色
        accent2: "#4cc2ff",  // 青蓝：徽章辉光/链接
        text: "#e8edf4",
        muted: "#8b95a7",
        warn: "#ff7a6e",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(76,194,255,0.30), 0 0 18px rgba(76,194,255,0.22), 0 8px 30px rgba(53,224,208,0.10)",
        "glow-soft": "0 0 14px rgba(76,194,255,0.14), 0 6px 24px rgba(0,0,0,0.35)",
        "glow-teal": "0 0 0 1px rgba(53,224,208,0.35), 0 0 16px rgba(53,224,208,0.25)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "badge-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 1px rgba(76,194,255,0.35), 0 0 12px rgba(76,194,255,0.25)" },
          "50%": { boxShadow: "0 0 0 1px rgba(76,194,255,0.55), 0 0 22px rgba(76,194,255,0.45)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "badge-pulse": "badge-pulse 2.6s ease-in-out infinite",
        "pop-in": "pop-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
