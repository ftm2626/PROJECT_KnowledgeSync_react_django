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
export function readIdentity(): Identity | null {
  try {
    const value = JSON.parse(
      localStorage.getItem("knowledgesync.identity") || "null",
    );
    return value?.token && value?.user?.id ? value : null;
  } catch {
    return null;
  }
}
api.interceptors.request.use((config) => {
  const identity = readIdentity();
  if (identity) config.headers.Authorization = "Token " + identity.token;
  return config;
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
