/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
     "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        olive: '#96A78D',    // Botones primarios, textos destacados
        lightgreen: '#B6CEB4', // Enlaces, bordes focus
        pale: '#D9E9CF',     // Fondos secundarios, gradientes
        softgray: '#F0F0F0', // Fondos principales, bordes
      },
    },
  },
  plugins: [],
}

