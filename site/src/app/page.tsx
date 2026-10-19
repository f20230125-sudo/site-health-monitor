import { Health } from "@/components/Health";
import { loadHealth } from "@/lib/load";

export default function Page() {
  return <Health r={loadHealth()} repoUrl={process.env.NEXT_PUBLIC_REPO_URL} />;
}
