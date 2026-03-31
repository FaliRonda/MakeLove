/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        'card': '0 4px 24px -6px rgba(0, 0, 0, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
        'nav': '0 -12px 40px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(167, 139, 250, 0.08)',
        'accent': '0 4px 20px -2px rgba(34, 211, 238, 0.35)',
        'accent-lg': '0 8px 28px -4px rgba(34, 211, 238, 0.45)',
      },
      colors: {
        // ═══ PingusLove: morados del logo + cian hielo (pingüino) ═══
        app: {
          bg: '#0a0612',
          surface: '#140f1f',
          'surface-alt': '#1f1730',
          border: '#2d2540',
          'border-hover': '#3d3558',
          accent: '#38bdf8',
          'accent-hover': '#7dd3fc',
          muted: '#9d95b8',
          foreground: '#ede9fe',
          'foreground-dark': '#faf5ff',
        },
      },
    },
  },
  plugins: [],
}
