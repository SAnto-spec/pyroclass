import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  timeout: 8000,
  headers: { "Content-Type": "application/json" },
});

// Interceptor to surface friendly errors
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    // Keep network errors readable for hooks
    return Promise.reject(err);
  }
);
