// สร้าง error พร้อม status เช่น 400 / 401 / 409 ให้ error handler ใน app.mjs ใช้
export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
