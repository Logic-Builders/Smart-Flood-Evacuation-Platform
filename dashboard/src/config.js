// ?? (not ||) so a deliberately empty REACT_APP_API_URL="" — same-origin
// requests via the nginx proxy in Docker — isn't overridden by the fallback.
export const BASE_URL = process.env.REACT_APP_API_URL ?? "http://localhost:8080";
