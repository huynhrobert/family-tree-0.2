import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        male: '#3b82f6',
        female: '#f472b6',
        neutral: '#64748b',
        living: '#22c55e',
        deceased: '#ef4444',
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}

export default config

