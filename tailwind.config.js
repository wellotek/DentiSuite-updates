/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clinic: {
          50: '#f0f7fb',
          100: '#d9ecf5',
          200: '#b3d8ea',
          300: '#7cbad8',
          400: '#3d96c0',
          500: '#1f7aa8',
          600: '#0e628e',
          700: '#0c4f73',
          800: '#0e4360',
          900: '#0b3d5c',
          950: '#07263b',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
}
