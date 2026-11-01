import { HomeView } from "@nb-hub/views/home";

export default function HomePage() {
  return <HomeView apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"} />;
}
