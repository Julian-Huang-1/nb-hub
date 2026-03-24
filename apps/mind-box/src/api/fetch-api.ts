export const fetchApi = async () => {
  const response = await fetch("https://hjxgogogo.me/api");
  return response.json();
};
