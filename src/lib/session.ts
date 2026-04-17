import "server-only";
import { cookies } from "next/headers";
import {
	SESSION_COOKIE_MAX_AGE,
	SESSION_COOKIE_NAME,
} from "./session-constants";

export async function getSessionToken(): Promise<string | undefined> {
	const jar = await cookies();
	return jar.get(SESSION_COOKIE_NAME)?.value;
}

export async function setSessionToken(token: string): Promise<void> {
	const jar = await cookies();
	jar.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_COOKIE_MAX_AGE,
	});
}

export async function clearSessionToken(): Promise<void> {
	const jar = await cookies();
	jar.delete(SESSION_COOKIE_NAME);
}
