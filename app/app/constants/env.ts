// Expo inlines EXPO_PUBLIC_* variables from app/.env at build time (SDK 49+, no
// app.config changes needed). Falls back to the dev LAN IP if unset.
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.161.107.194:8080';
console.warn('[env] BASE_URL =', BASE_URL);

// Required by Expo Router
export default {};
