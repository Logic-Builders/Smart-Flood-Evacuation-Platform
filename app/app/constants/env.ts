// Expo inlines EXPO_PUBLIC_* variables from app/.env at build time (SDK 49+, no
// app.config changes needed). Falls back to the dev LAN IP if unset.
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.10.11.136:8080';

// Required by Expo Router
export default {};
