/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0A0714', alt: '#110A1F' },
        card: '#1A1028',
        elevated: '#241638',
        primary: { DEFAULT: '#A855F7', neon: '#C084FC' },
        sakura: '#FF79C6',
        profit: '#47D7AC',
        loss: '#FF4D6D',
        ink: { DEFAULT: '#F8F4FF', muted: '#A99AB9' },
        line: '#38244D',
      },
      fontFamily: {
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        brand: ['"Caveat"', 'cursive'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(168,85,247,0.55)',
        'glow-sm': '0 0 12px -2px rgba(168,85,247,0.5)',
        'glow-pink': '0 0 26px -6px rgba(255,121,198,0.55)',
        card: '0 10px 30px -12px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'grid-glow': 'radial-gradient(1200px 600px at 15% -10%, rgba(168,85,247,0.20), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(255,121,198,0.14), transparent 60%)',
        'btn-primary': 'linear-gradient(135deg,#A855F7 0%,#C084FC 45%,#FF79C6 100%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'petal': {
          '0%': { transform: 'translate3d(0,-10vh,0) rotate(0deg)', opacity: '0' },
          '12%': { opacity: '0.85' },
          '100%': { transform: 'translate3d(6vw,110vh,0) rotate(420deg)', opacity: '0' },
        },
        'pulse-glow': { '0%,100%': { boxShadow: '0 0 0 0 rgba(168,85,247,0.45)' }, '50%': { boxShadow: '0 0 0 12px rgba(168,85,247,0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .45s ease-out both',
        petal: 'petal linear infinite',
        'pulse-glow': 'pulse-glow 2.6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
      },
    },
  },
  plugins: [],
};
