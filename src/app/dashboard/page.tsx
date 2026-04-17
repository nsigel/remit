import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
	const session = await api.student.getSession();
	if (!session) redirect("/demo");

	return <DashboardClient />;
}
