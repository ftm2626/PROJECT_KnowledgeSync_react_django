import { translate, type Language } from "../i18n/messages";
import axios from "axios";
import type { Identity } from "../types";
const host = window.location.hostname;
export const api = axios.create({
  baseURL:
    (
      import.meta.env.VITE_API_BASE_URL ||
      window.location.protocol + "//" + host + ":8000/api"
    ).replace(/\/$/, "") + "/",
  timeout: 15000,
});
function loadIdentity(): Identity | null {
  try {
    const value = JSON.parse(
      localStorage.getItem("knowledgesync.identity") || "null",
    );
    return value?.token && value?.user?.id ? value : null;
  } catch {
    return null;
  }
}
let currentIdentity = loadIdentity();
const identityListeners = new Set<(identity: Identity | null) => void>();
export function readIdentity() { return currentIdentity; }
export function writeIdentity(identity: Identity | null) {
  currentIdentity = identity;
  try {
    if (identity) localStorage.setItem('knowledgesync.identity', JSON.stringify(identity));
    else localStorage.removeItem('knowledgesync.identity');
  } catch { /* Authentication still works in memory when storage is unavailable. */ }
  identityListeners.forEach(listener => listener(identity));
}
export function subscribeIdentity(listener: (identity: Identity | null) => void) {
  identityListeners.add(listener);
  return () => { identityListeners.delete(listener); };
}
api.interceptors.request.use((config) => {
  const identity = readIdentity();
  if (identity) config.headers.Authorization = "Token " + identity.token;
  return config;
});
api.interceptors.response.use(response => response, error => {
  const identity = readIdentity();
  // A delayed response from a previous login must not sign out the current user.
  if (error.response?.status === 401 && error.config?.url !== 'auth/login/' && identity &&
      error.config?.headers?.Authorization === 'Token ' + identity.token) {
    writeIdentity(null);
  }
  return Promise.reject(error);
});
export function errorMessage(
  error: unknown,
  language: Language = "en",
): string {
  const t = (key: string) => translate(language, key);
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data?.detail === "string") return t(data.detail);
    if (data && typeof data === "object")
      return Object.entries(data)
        .map(
          ([key, value]) =>
            t(key) +
            ": " +
            (Array.isArray(value)
              ? value.map((item) => t(String(item))).join(" ")
              : t(String(value))),
        )
        .join(" ");
    return t(
      error.response
        ? "Something went wrong. Please try again."
        : "Cannot reach the API. Check that Django is running on port 8000.",
    );
  }
  return t("Something went wrong. Please try again.");
}
