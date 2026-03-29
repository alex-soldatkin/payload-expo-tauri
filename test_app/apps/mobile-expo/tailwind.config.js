/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './global.css',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1f1f1f',
          muted: '#666666',
        },
        paper: '#f6f4f1',
        surface: '#ffffff',
      },
    },
  },
  plugins: [],
}
