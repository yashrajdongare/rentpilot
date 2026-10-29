/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"EB Garamond"', 'serif'],
        serif: ['"EB Garamond"', 'serif'],
      },
    },
  },
  plugins: [],
}