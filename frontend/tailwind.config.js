/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        luxury: {
          bg: '#0A0B0E',        // Velvety Carbon Obsidian
          surface: '#111318',   // Primary card surface
          elevated: '#171922',  // Hovered / Elevated module
          card: '#14161E',      // Card canvas
          border: '#2C261C',    // Antique bronze border
          borderLight: '#433A2A',// Highlighted bronze hairline
          gold: '#F5D061',      // Luminous Champagne Gold
          goldDark: '#D99B26',  // Imperial Gold
          goldMuted: '#967332', // Muted Gold Text
          sand: '#E6DEC9',      // Soft cream sandstone
          sandDark: '#A89E88',  // Secondary labels
          emerald: '#10B981',   // Verified Jade
          crimson: '#E11D48',   // Royal Ruby
          amber: '#F59E0B',     // Topaz Amber
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Courier New', 'monospace'],
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gold-sm': '0 0 10px -2px rgba(245, 208, 97, 0.15)',
        'gold-md': '0 4px 20px -2px rgba(245, 208, 97, 0.2)',
        'gold-lg': '0 8px 30px -4px rgba(217, 155, 38, 0.25)',
        'card-fintech': '0 8px 24px -4px rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(245, 208, 97, 0.08)',
      }
    },
  },
  plugins: [],
}
