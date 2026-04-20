/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        saturday: '#bfefff',
        sunday: '#ffcc99',
        holiday: '#ffcccc',
        schoolEvent: '#ccf2ff',
        longBreak: '#ccffcc',
      },
    },
  },
  plugins: [],
}
