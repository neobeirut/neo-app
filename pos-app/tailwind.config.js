import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
    './pos-app/index.html',
    './pos-app/src/**/*.{js,ts,jsx,tsx}',
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
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
