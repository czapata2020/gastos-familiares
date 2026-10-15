import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(
        ['bg', 'surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'line', 'accent', 'accent-ink', 'accent-soft',
          'p1', 'p2', 'good', 'warn', 'bad'].map(n => [n, token(n)]),
      ),
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl2: '1.125rem' },
    },
  },
  plugins: [],
}

export default config
