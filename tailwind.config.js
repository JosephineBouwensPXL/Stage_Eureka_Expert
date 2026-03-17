/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        studybuddy: {
          blue: '#4c84ff',
          magenta: '#e61e6e',
          yellow: '#fbc02d',
          dark: '#1a1a1a',
          light: '#f8fafc',
        },
      },
    },
  },
  plugins: [],
};
