/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#F4F7FB',
          dark: '#0F172A',
        },
        card: {
          light: '#FFFFFF',
          dark: '#1E293B',
        },
        primaryBlue: '#5A8DEE',
        accentGreen: '#34D399',
      },
      boxShadow: {
        'neumorphic-flat': '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
        'neumorphic-flat-dark': '6px 6px 12px #0a0f1d, -6px -6px 12px #1e293b',
        'neumorphic-pressed': 'inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff',
        'neumorphic-pressed-dark': 'inset 6px 6px 12px #0a0f1d, inset -6px -6px 12px #1e293b',
      },
      borderRadius: {
        'large': '24px',
        'medium': '16px',
      }
    },
  },
  plugins: [],
};
