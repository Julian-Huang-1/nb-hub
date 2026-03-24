export const fetchApi = async () => {
  const response = await fetch("https://api.hjxgogogo.me/health");
  return response.json();
};
