import { requireUser } from "@/server/users";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold">Welcome, @{user.username}</h1>
      <p className="text-muted-foreground">Your dashboard is being built.</p>
    </div>
  );
}
