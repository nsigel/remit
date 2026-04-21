/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const config = {
	turbopack: {
		root: path.dirname(fileURLToPath(import.meta.url)),
	},
};

export default config;
