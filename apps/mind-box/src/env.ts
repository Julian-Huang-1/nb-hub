export const getApiBase = (): string => {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  if (typeof base === "string" && base.length > 0) {
    return base.replace(/\/$/, "");
  }
  return "";
};
