/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hpc: {
          dark: '#0B131A',       // Deep abyssal slate background
          card: '#15222E',       // Server rack card background
          cardHover: '#1B2C3B',  // Elevated server module
          border: '#2A3B4D',     // Brushed titanium border
          borderLight: '#3D546C',// Highlighted server slot
          cyan: '#38BDF8',       // VRAM Cyan
          green: '#10B981',      // Hardware Verified Green
          red: '#F43F5E',        // Thermal Throttling / Fraud Red
          amber: '#F59E0B',      // In Audit Amber
          muted: '#94A3B8',      // Monospace label muted
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Courier New', 'monospace'],
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'hpc-glow': '0 0 15px -3px rgba(56, 189, 248, 0.25)',
        'rack-glow': '0 0 20px -5px rgba(16, 185, 129, 0.2)',
        'thermal-glow': '0 0 20px -5px rgba(244, 63, 94, 0.25)',
      }
    },
  },
  plugins: [],
}
