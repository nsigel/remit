import { RedirectIfDemoSession } from "./_components/demo-session-guard";
import { HomePageContent } from "./home-page-content";

export default function Home() {
	return (
		<RedirectIfDemoSession>
			<HomePageContent />
		</RedirectIfDemoSession>
	);
}
