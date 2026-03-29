/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0e14',
          header: '#0d1117',
          sidebar: '#0d1117',
          card: '#111720',
          'card-hover': '#161d28',
          border: '#1c2333',
          'border-bright': '#2d3548',
          text: '#8b949e',
          muted: '#484f58',
          green: '#00d68f',
          red: '#ff4757',
          cyan: '#39d2e3',
          yellow: '#e3b341',
          orange: '#f0883e',
          blue: '#58a6ff',
          purple: '#bc8cff',
        },
        dark: {
          50: '#f6f6f7',
          100: '#e1e3e5',
          200: '#c3c6cb',
          300: '#9da2aa',
          400: '#797f89',
          500: '#5f656f',
          600: '#4b4f58',
          700: '#3d4048',
          800: '#1a1d23',
          850: '#151820',
          900: '#0d1017',
          950: '#080a0f',
        },
        accent: {
          green: '#00d68f',
          red: '#ff4757',
          blue: '#58a6ff',
          purple: '#bc8cff',
          yellow: '#e3b341',
          orange: '#f0883e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'ticker': 'ticker 30s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
