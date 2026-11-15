/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Fraunces Variable"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary palette — approved mockups
        ivory:      '#FFF8F0',
        plum:       { DEFAULT: '#352238', light: '#442A4D' },
        terra:      { DEFAULT: '#B84E3B', dark: '#9A3F2F', light: '#D4654F' },
        peach:      { DEFAULT: '#F4D4C3', light: '#FAE8DC' },
        lavender:   { DEFAULT: '#E4DCEF', light: '#F0EBF7' },
        sage:       { DEFAULT: '#DCE5D7', light: '#EBF0E7', dark: '#8EA886' },

        // Functional
        ink:        '#352238',
        border:     '#E3D8CC',
        cream:      { DEFAULT: '#FFF8F0', light: '#FFFCF8' },

        // Score display
        score: {
          good: '#5A8A6B',
          mid:  '#C08840',
          low:  '#B84E3B',
        },

        // Legacy compat (used in review form, remove page)
        coral:  '#B84E3B',
        amber:  '#C08840',
        teal:   '#5A8A6B',
      },
      borderRadius: {
        arch: '50% 50% 0 0',
      },
      maxWidth: {
        'content': '72rem',   // 1152px
        'narrow':  '48rem',   // 768px
        'reading': '40rem',   // 640px
      },
    },
  },
  plugins: [],
};
