/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0f1117',
        'bg-surface': '#1a1d27',
        'bg-elevated': '#222633',
        border: '#2a2e3d',
        'text-primary': '#e1e4ed',
        'text-secondary': '#8b8fa3',
        accent: '#6c8aff',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
      },
    },
  },
  plugins: [],
}