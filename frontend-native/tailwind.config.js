/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        autumn: {
          background: '#050505',
          surface: '#111311',
          elevated: '#202020',
          amber: '#e6a44a',
          amberBright: '#f1b65d',
          eyebrow: '#d29a55',
          teal: '#42c5d9',
          text: '#f7f4ee',
          muted: '#9b9994',
          border: 'rgba(255,255,255,0.1)',
        },
      },
      fontFamily: {
        body: ['DMSans'],
        display: ['SpaceGrotesk'],
      },
    },
  },
  plugins: [],
}