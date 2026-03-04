/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ═══ TEMA DE LA APP (tema oscuro) ═══
        // Cambiar solo estos valores para aplicar el tema en toda la aplicación.
        // Ver docs/TEMA.md para la guía completa.
        app: {
          bg: '#0f0d14',              // Fondo de página (muy oscuro)
          surface: '#1a1625',         // Tarjetas, paneles, inputs
          'surface-alt': '#252038',   // Fondos elevados (tabs activos, badges)
          border: '#2d2840',          // Bordes
          'border-hover': '#3d3552',  // Bordes al hover
          accent: '#2dd4bf',          // Botones principales, enlaces (turquesa)
          'accent-hover': '#5eead4',  // Hover de botones/enlaces
          muted: '#94a3b8',           // Texto secundario
          foreground: '#e2e8f0',     // Títulos y texto principal
          'foreground-dark': '#f1f5f9', // Texto más fuerte
        },
      },
    },
  },
  plugins: [],
}
