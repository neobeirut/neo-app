/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./admin/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pos-app/index.html",
    "./pos-app/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'pos-primary': 'var(--pos-primary, #1e5c4f)',
        'pos-primary-hover': 'var(--pos-primary-hover, #16463c)',
        'pos-primary-light': 'var(--pos-primary-light, #528c80)',
      }
    },
  },
  plugins: [],
}
