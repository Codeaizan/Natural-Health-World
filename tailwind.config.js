// JSDoc type annotation specifying this is a Tailwind CSS configuration
/** @type {import('tailwindcss').Config} */
// Export the default Tailwind configuration object
export default {
  // Configure template paths to scan for Tailwind classnames
  content: [
    // Scan the index.html file for classnames
    "./index.html",
    // Scan all src directory files with js, ts, jsx, tsx extensions
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Configure theme extensions and customizations
  theme: {
    // Extend default theme without overriding it
    extend: {},
  },
  // Array of Tailwind plugins to extend functionality
  plugins: [],
}
