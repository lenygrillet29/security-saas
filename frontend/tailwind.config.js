/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#050711',
          900: '#0F1117',
          800: '#1A1D2E',
          700: '#21253A',
          600: '#2D3555',
          500: '#3D4875',
        },
      },
    },
  },
  plugins: [],
};
