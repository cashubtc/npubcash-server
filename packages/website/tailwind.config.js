/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        marquee2: "marquee2 40s linear infinite",
        marquee: "marquee 40s linear infinite",
        fadein: "fadeInUp 0.8s linear forwards",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        marquee2: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0%)" },
        },
        fadeInUp: {
          from: {
            transform: "translate3d(0,30px,0)",
          },
          to: {
            transform: "translate3d(0,0,0)",
            opacity: 1,
          },
        },
      },
    },
  },
  plugins: [],
};
