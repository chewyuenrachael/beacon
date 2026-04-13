import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cream: {
          50: '#FAFAF7',
          100: '#F5F4F0',
          200: '#EEECE5',
          300: '#E0DDD4',
        },
        ink: {
          900: '#1A1A1A',
          700: '#3D3D3A',
          500: '#6B6B65',
          300: '#9C9A92',
        },
        accent: {
          terracotta: '#C55A3A',
        },
      },
    },
  },
  plugins: [],
};
export default config;
