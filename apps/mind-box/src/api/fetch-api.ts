export const fetchApi = async () => {
  const response = await fetch("https://api.hjxgogogo.me/db-test");
  return response.json();
};
