import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1c2430",
        paper: "#e8edf5",
        line: "#e2e5ea",
        accent: "#2f5d50",
        accentDark: "#1f4038",
        warn: "#b5482a",
        green: "#2f7d4f",
        blue: "#2f6ea5",
        orange: "#c07a1f",
        grey: "#7a8088",
        red: "#b23b3b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
