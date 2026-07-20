import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  // Required so the browser sends/receives the httpOnly session cookie
  // (and the anonymous rate-limit cookie) on cross-origin requests.
  withCredentials: true,
});

export default api;
