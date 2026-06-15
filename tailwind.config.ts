import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef4f7',
          100: '#cfe3ec',
          400: '#5a8fa8',
          500: '#35627A',
          600: '#2c5268',
          700: '#1e3a4a',
        },
        terracotta: {
          100: '#f4e0de',
          300: '#d4938c',
          500: '#B46258',
          700: '#8f4a41',
        },
        blush:    '#E5AEA9',
        lavender: '#A6A9D0',
        sage:     '#8E9A98',
        ash:      '#F5F5F5',
      },
    },
  },
  plugins: [],
}

export default config
