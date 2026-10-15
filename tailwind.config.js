/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Instrument panel" palette — deep space indigo with a phosphor-teal accent.
        panel: {
          950: '#0a0d16',
          900: '#0f1320',
          800: '#161b2c',
          700: '#1e2438',
          600: '#2a3149',
        },
        phosphor: {
          DEFAULT: '#4fe3c1',
          dim: '#2ea88e',
          bright: '#8ffbdf',
        },
        amber: {
          signal: '#ffb454',
        },
        violet: {
          signal: '#a78bfa',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        glow: '0 0 24px rgba(79, 227, 193, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.94)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'pop': 'pop 0.12s ease-out',
      },
    },
  },
  plugins: [],
};
