/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cloud: {
          bg: '#0B0F19',        // Deep neutral zinc/slate canvas
          card: '#111827',      // Primary card surface (Gray 900)
          cardHover: '#161F32', // Hovered card
          elevated: '#1F2937',  // Elevated element (Gray 800)
          border: '#2A364F',    // Clean subtle border
          borderLight: '#374151',
          azure: '#3B82F6',     // Lambda/RunPod Azure blue
          azureHover: '#2563EB',
          azureLight: '#60A5FA',
          emerald: '#10B981',   // Verified Green
          rose: '#EF4444',      // Failed / Alert Red
          amber: '#F59E0B',     // In Audit / Provisioning
          slate: '#94A3B8',     // Secondary text
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Courier New', 'monospace'],
        sans: ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'cloud-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        'cloud-md': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        'cloud-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
        'azure-glow': '0 0 16px -2px rgba(59, 130, 246, 0.3)',
      }
    },
  },
  plugins: [],
}
