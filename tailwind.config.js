/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#4353ff',
        primary2: '#7058f4',
        teal: '#0ea5a0',
        rose: '#f0386b',
        amber: '#d97706',
        ink: '#0b1329',
        muted: '#64748b',
        surface: '#f1f4fc',
      },
      borderRadius: {
        card: '28px',
        tile: '20px',
        btn: '14px',
      },
      boxShadow: {
        glass: '0 12px 32px 0 rgba(67, 83, 255, 0.12), inset 0 1px 1px 0 rgba(255, 255, 255, 0.85)',
      },
    },
  },
  plugins: [],
}
