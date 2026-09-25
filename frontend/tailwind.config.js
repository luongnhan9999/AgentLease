/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#04070D', // Cosmic Obsidian Void
          900: '#080E1A', // Base Canvas
          850: '#0C1425', // Card Surface
          800: '#121D33', // Elevated Module
          750: '#192642', // Hovered Module
          700: '#223456', // Fine Titanium Border
          600: '#324B78', // Highlight Border
          500: '#64748B', // Muted Text
          400: '#94A3B8', // Regular Label
          300: '#CBD5E1', // High-contrast Text
        },
        plasma: {
          cyan: '#00F0FF',     // Cryo Ion Cyan
          cyanGlow: '#06B6D4',
          violet: '#818CF8',   // Superconductor Violet
          violetDark: '#4F46E5',
          emerald: '#10B981',  // Verified Consensus Green
          rose: '#F43F5E',     // Hardware Fraud Alert
          amber: '#F59E0B',    // Active Deliberation Amber
          electric: '#38BDF8', // Telemetry Blue
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Courier New', 'monospace'],
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'quantum-cyan': '0 0 25px -3px rgba(0, 240, 255, 0.25)',
        'quantum-violet': '0 0 25px -3px rgba(129, 140, 248, 0.25)',
        'quantum-emerald': '0 0 25px -3px rgba(16, 185, 129, 0.25)',
        'quantum-rose': '0 0 25px -3px rgba(244, 63, 94, 0.3)',
        'quantum-card': '0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'radial-gradient-hero': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6, 182, 212, 0.15), rgba(79, 70, 229, 0.05), transparent)',
        'grid-pattern': 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
      },
      animation: {
        'scanline': 'scanline 6s linear infinite',
        'subtle-pulse': 'subtlePulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orbit': 'orbit 20s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
        subtlePulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.02)' },
        }
      }
    },
  },
  plugins: [],
}
