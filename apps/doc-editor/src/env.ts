export const getApiBase = (): string => {
  const base =
    import.meta.env.NODE_ENV === "production"
      ? "http://api.hjxgogogo.me"
      : "http://localhost:9999";
  if (typeof base === "string" && base.length > 0) {
    return base.replace(/\/$/, "");
  }
  return "";
};
