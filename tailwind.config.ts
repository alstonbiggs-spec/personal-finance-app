import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#18231f', forest: '#173d35', gold: '#ad8a50', cream: '#f5f3ee', mist: '#e8ebe5' }, fontFamily: { serif: ['Georgia', 'serif'], sans: ['Arial', 'sans-serif'] } } }, plugins: [] };
export default config;
