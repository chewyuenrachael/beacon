import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "var(--bg)",
        foreground: "var(--text-primary)",

        /* semantic surface tokens */
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
        },

        /* semantic text tokens */
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-muted)",
          muted: "var(--text-muted)",
        },

        /* semantic border tokens */
        border: {
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },

        /* accent */
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          terracotta: "var(--accent)",
        },

        /* legacy palette — maps to new tokens so existing classes keep working */
        cream: {
          50: "var(--bg)",
          100: "var(--surface-raised)",
          200: "var(--border-subtle)",
          300: "#E0DDD4",
        },
        ink: {
          900: "var(--text-primary)",
          700: "var(--text-secondary)",
          500: "var(--text-muted)",
          300: "#9C9A92",
        },
      },
      typography: {
        resource: {
          css: {
            "--tw-prose-body": "var(--text-primary)",
            "--tw-prose-headings": "var(--text-primary)",
            "--tw-prose-links": "var(--text-primary)",
            "--tw-prose-bold": "var(--text-primary)",
            "--tw-prose-counters": "var(--text-muted)",
            "--tw-prose-bullets": "var(--text-muted)",
            "--tw-prose-hr": "var(--border-subtle)",
            "--tw-prose-quotes": "var(--text-primary)",
            "--tw-prose-quote-borders": "var(--border-strong)",
            "--tw-prose-code": "var(--text-primary)",
            "--tw-prose-pre-bg": "var(--surface-raised)",
            "--tw-prose-th-borders": "var(--border-subtle)",
            "--tw-prose-td-borders": "var(--border-subtle)",
            fontSize: "1.0625rem",
            lineHeight: "1.75",
            maxWidth: "none",

            p: { marginTop: "1.25em", marginBottom: "1.25em" },

            h1: {
              fontSize: "1.75rem",
              fontWeight: "600",
              marginTop: "0",
              marginBottom: "0.75em",
            },
            h2: {
              fontSize: "1.5rem",
              fontWeight: "600",
              marginTop: "2.5em",
              marginBottom: "0.75em",
              paddingTop: "1.25em",
              borderTopWidth: "1px",
              borderTopColor: "var(--border-subtle)",
            },
            "h2:first-child": {
              marginTop: "0",
              paddingTop: "0",
              borderTopWidth: "0",
            },
            h3: {
              fontSize: "1.2rem",
              fontWeight: "600",
              marginTop: "1.75em",
              marginBottom: "0.5em",
            },

            a: {
              color: "var(--text-primary)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
              textDecorationColor: "var(--border-subtle)",
              "&:hover": {
                color: "var(--accent)",
                textDecorationColor: "var(--accent)",
              },
            },

            blockquote: {
              fontStyle: "normal",
              borderLeftWidth: "2px",
              borderLeftColor: "var(--border-strong)",
              backgroundColor: "var(--surface-raised)",
              borderRadius: "0.375rem",
              padding: "1rem 1.25rem",
              marginTop: "1.5em",
              marginBottom: "1.5em",
              "p:first-child": { marginTop: "0" },
              "p:last-child": { marginBottom: "0" },
            },

            code: {
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.875em",
              backgroundColor: "var(--surface-raised)",
              padding: "0.2em 0.4em",
              borderRadius: "0.25rem",
              fontWeight: "400",
            },
            "code::before": { content: "none" },
            "code::after": { content: "none" },

            pre: {
              backgroundColor: "var(--surface-raised)",
              borderRadius: "0.5rem",
              border: "1px solid var(--border-subtle)",
              padding: "1rem",
              code: {
                backgroundColor: "transparent",
                padding: "0",
                borderRadius: "0",
              },
            },

            table: {
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9375rem",
            },
            thead: {
              borderBottomWidth: "1px",
              borderBottomColor: "var(--border-subtle)",
            },
            "thead th": {
              backgroundColor: "var(--surface-raised)",
              fontWeight: "600",
              padding: "0.75rem 1rem",
              textAlign: "left",
              fontSize: "0.8125rem",
              textTransform: "uppercase",
              letterSpacing: "0.025em",
              color: "var(--text-secondary)",
            },
            "tbody td": {
              padding: "0.75rem 1rem",
              borderBottomWidth: "1px",
              borderBottomColor: "var(--border-subtle)",
              verticalAlign: "top",
            },
            "tbody tr:last-child td": { borderBottomWidth: "0" },

            li: { marginTop: "0.375em", marginBottom: "0.375em" },
            "ul > li::marker": { color: "var(--text-muted)" },
            "ol > li::marker": { color: "var(--text-muted)" },

            hr: {
              borderColor: "var(--border-subtle)",
              marginTop: "2.5em",
              marginBottom: "2.5em",
            },

            strong: { fontWeight: "600", color: "var(--text-primary)" },
          },
        },
      },
    },
  },
  plugins: [typography],
};
export default config;
