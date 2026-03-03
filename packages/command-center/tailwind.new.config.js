/** @type {import('tailwindcss').Config} */

const sizes = {
  '2xs': 0.5,
  xs: 0.75,
  sm: 0.875,
  base: 1,
  lg: 1.125,
  xl: 1.25,
};

const lineHeightMultiplier = 1.5;
const radiusMultiplier = 0.25;
const iconMultiplier = 1.25;

function getSize(sizeLabel, multiplier = 1) {
  return sizes[sizeLabel] * multiplier + 'rem';
}

module.exports = {
  darkMode: ['class'],
  important: false,
  content: [
    './src/**/*.{ts,tsx}',
    '../web-core/src/**/*.{ts,tsx}',
    '../ui/src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      size: {
        'icon-2xs': getSize('2xs', iconMultiplier),
        'icon-xs': getSize('xs', iconMultiplier),
        'icon-sm': getSize('sm', iconMultiplier),
        'icon-base': getSize('base', iconMultiplier),
        'icon-lg': getSize('lg', iconMultiplier),
        'icon-xl': getSize('xl', iconMultiplier),
      },
      ringColor: {
        DEFAULT: 'hsl(var(--brand))',
      },
      fontSize: {
        xs: [
          getSize('xs'),
          { lineHeight: getSize('xs', lineHeightMultiplier) },
        ],
        sm: [
          getSize('sm'),
          { lineHeight: getSize('sm', lineHeightMultiplier) },
        ],
        base: [
          getSize('base'),
          { lineHeight: getSize('base', lineHeightMultiplier) },
        ],
        lg: [
          getSize('lg'),
          { lineHeight: getSize('lg', lineHeightMultiplier) },
        ],
        xl: [
          getSize('xl'),
          { lineHeight: getSize('xl', lineHeightMultiplier) },
        ],
      },
      spacing: {
        half: getSize('base', 0.25),
        base: getSize('base', 0.5),
        plusfifty: getSize('base', 0.75),
        double: getSize('base', 1),
      },
      colors: {
        high: 'hsl(var(--text-high))',
        normal: 'hsl(var(--text-normal))',
        low: 'hsl(var(--text-low))',
        primary: 'hsl(var(--bg-primary))',
        secondary: 'hsl(var(--bg-secondary))',
        panel: 'hsl(var(--bg-panel))',
        brand: 'hsl(var(--brand))',
        'brand-hover': 'hsl(var(--brand-hover))',
        'brand-secondary': 'hsl(var(--brand-secondary))',
        error: 'hsl(var(--error))',
        success: 'hsl(var(--success))',
        merged: 'hsl(var(--merged))',
        'on-brand': 'hsl(var(--text-on-brand))',
        background: 'hsl(var(--bg-primary))',
        foreground: 'hsl(var(--text-normal))',
        border: 'hsl(var(--border))',
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
        border: 'hsl(var(--border))',
      },
      borderRadius: {
        lg: getSize('lg', radiusMultiplier),
        md: getSize('sm', radiusMultiplier),
        sm: getSize('xs', radiusMultiplier),
      },
      fontFamily: {
        'ibm-plex-sans': ['"IBM Plex Sans"', '"Noto Emoji"', 'sans-serif'],
        'ibm-plex-mono': ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/container-queries'),
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
};
