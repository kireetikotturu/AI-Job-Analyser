/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF3E7",
        peach: "#F4D9BE",
        sage: "#DCE6DD",
        ink: "#161616",
        accent: {
          purple: "#6D5BF0",
          pink: "#EE5FA0",
          orange: "#F0703C",
        },
      },
      fontFamily: {
        display: ["Georgia", "ui-serif", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      }
      ,
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(22, 22, 22, 0.06)",
        card: "0 4px 24px rgba(22, 22, 22, 0.08)",
        glow: "0 8px 40px rgba(109, 91, 240, 0.25)",
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #FBF3E7 0%, #F4D9BE 50%, #DCE6DD 100%)",
        "purple-gradient": "linear-gradient(135deg, #6D5BF0 0%, #EE5FA0 100%)",
      },
    },
  },
  plugins: [],
};
