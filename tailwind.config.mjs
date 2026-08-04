/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Fraunces Variable"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      colors: {
        plum: { DEFAULT: '#2E2138', 2: '#442A4D' },
        coral: '#E2674A',
        amber: '#EBA048',
        teal: '#3E7C7B',
        ink: '#2B2230',
        light: '#F4F1F4',
        border: '#E3DEE6',
        cream: { DEFAULT: '#FBEFE6', light: '#FDF6EF' },
        score: { good: '#3E8E7E', mid: '#EBA048', low: '#D9645A' },
      },
    },
  },
  plugins: [],
};
