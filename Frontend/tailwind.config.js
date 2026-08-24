/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './services/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/orbcafe-ui/dist/**/*.{js,mjs}',
  ],
  safelist: ['ml-0', 'ml-4', 'ml-8', 'ml-12', 'ml-16', 'ml-20'],
  theme: {
    extend: {},
  },
  plugins: [],
};
