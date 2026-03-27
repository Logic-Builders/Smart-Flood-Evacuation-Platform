export const USERS = {
  admin1: "admin123",
  admin2: "flood2024",
};

export function validateLogin(username, password) {
  return USERS[username] && USERS[username] === password;
}