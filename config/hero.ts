import { heroui } from '@heroui/react';

export default heroui({
  themes: {
    light: {
      colors: {
        background: '#f7efe8',
        foreground: '#22181f',

        default: {
          DEFAULT: '#fffaf6',
          foreground: '#22181f',
        },

        primary: {
          50: '#f6ebf7',
          100: '#ead6ed',
          200: '#d5addb',
          300: '#c084c9',
          400: '#9a5b9d',
          500: '#6c3077',
          600: '#5f2a69',
          700: '#4f2358',
          800: '#3f1b46',
          900: '#2f1434',
          DEFAULT: '#6c3077',
          foreground: '#ffffff',
        },

        secondary: {
          50: '#fff4db',
          100: '#ffe7b3',
          200: '#ffd166',
          300: '#ffba1a',
          400: '#f29b00',
          500: '#d98b00',
          600: '#bf7a00',
          700: '#996200',
          800: '#734900',
          900: '#4d3100',
          DEFAULT: '#f29b00',
          foreground: '#22181f',
        },

        focus: '#f29b00',
      },
      layout: {
        radius: {
          small: '8px',
          medium: '14px',
          large: '20px',
        },
      },
    },

    dark: {
      colors: {
        background: '#1a1218',
        foreground: '#f8f2ee',

        default: {
          DEFAULT: '#2a1d27',
          foreground: '#f8f2ee',
        },

        primary: {
          DEFAULT: '#b86ac3',
          foreground: '#ffffff',
        },

        secondary: {
          DEFAULT: '#f29b00',
          foreground: '#22181f',
        },

        focus: '#f29b00',
      },
    },
  },
});
