// TypeScript 6 (TS2882) requires module declarations even for side-effect
// imports — covers `import '../global.css'` in app/_layout.tsx (NativeWind).
declare module '*.css'
