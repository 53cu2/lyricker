/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 歌詞制作に最適なダークモードのカラーパレットを定義
      colors: {
        slate: {
          950: '#020617',
        }
      },
    },
  },
  plugins: [],
}