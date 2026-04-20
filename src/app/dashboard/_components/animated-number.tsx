"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedNumberProps = {
	value: number;
	durationMs?: number;
	fractionDigits?: number;
	prefix?: string;
	suffix?: string;
	className?: string;
};

export function AnimatedNumber({
	value,
	durationMs = 700,
	fractionDigits = 2,
	prefix = "",
	suffix = "",
	className,
}: AnimatedNumberProps) {
	const [displayValue, setDisplayValue] = useState(value);
	const previousValueRef = useRef(value);

	useEffect(() => {
		const startingValue = previousValueRef.current;
		if (startingValue === value) return;

		let frameId = 0;
		const startedAt = performance.now();

		const tick = (now: number) => {
			const elapsed = now - startedAt;
			const progress = Math.min(1, elapsed / durationMs);
			const eased = 1 - (1 - progress) ** 3;
			setDisplayValue(startingValue + (value - startingValue) * eased);

			if (progress < 1) {
				frameId = window.requestAnimationFrame(tick);
				return;
			}

			previousValueRef.current = value;
		};

		frameId = window.requestAnimationFrame(tick);
		return () => window.cancelAnimationFrame(frameId);
	}, [durationMs, value]);

	useEffect(() => {
		if (previousValueRef.current === value) {
			setDisplayValue(value);
		}
	}, [value]);

	return (
		<span className={className}>
			{prefix}
			{displayValue.toLocaleString("en-US", {
				minimumFractionDigits: fractionDigits,
				maximumFractionDigits: fractionDigits,
			})}
			{suffix}
		</span>
	);
}
