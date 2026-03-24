/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"], // <- include everything inside app/
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};