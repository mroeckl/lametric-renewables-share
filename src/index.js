const API_BASE_URL = 'https://api.energy-charts.info/signal';
const SECS_PER_HOUR = 3600;
const ICONS = {
	GREEN: '12056',
	YELLOW: '11969',
	RED: '12057',
	BLUE: '1692',
};

export async function fetchData(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch: ${response.status} from ${url}`);
	}
	return response.json();
}

export function createFramesResponse(icon, currentShare, currentSignal, nextShareValues) {
	return new Response(
		JSON.stringify({
			frames: [
				{
					icon,
					goalData: {
						start: 0,
						current: currentShare,
						end: 100,
						unit: '%',
						currentSignal,
					},
				},
				{ chartData: nextShareValues },
			],
		}),
		{ headers: { 'Content-Type': 'application/json' } }
	);
}

export function createErrorResponse(message = 'Error', status = 500) {
	return new Response(JSON.stringify({ frames: [{ icon: ICONS.BLUE, text: message }] }), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export function getTimestampFloor(timestamps, targetTimestamp) {
	let closestTimestamp = -1;
	let closestDifference = Infinity;

	for (let i = 0; i < timestamps.length; i++) {
		const timestamp = timestamps[i];
		const difference = targetTimestamp - timestamp;

		if (difference >= 0 && difference < closestDifference) {
			closestDifference = difference;
			closestTimestamp = timestamp;
		}
	}
	return closestTimestamp;
}

export function getHourlyShares(data, startTimestamp, limit = 10) {
	const hourlyShares = [];
	let currentTimestamp = startTimestamp;
	let previousIndex = -1;

	for (let i = 0; i < limit; i++) {
		const nearestTimestamp = getTimestampFloor(data.unix_seconds, currentTimestamp);
		const index = data.unix_seconds.indexOf(nearestTimestamp);

		if (index === -1 || index === previousIndex || data.unix_seconds[index] - data.unix_seconds[previousIndex] < SECS_PER_HOUR) {
			break;
		}

		hourlyShares.push(data.share[index]);
		previousIndex = index;
		currentTimestamp += SECS_PER_HOUR;
	}
	return hourlyShares;
}

function getIcon(currentSignal) {
	switch (currentSignal) {
		case 0:
			return ICONS.GREEN;
		case 1:
			return ICONS.YELLOW;
		case 2:
			return ICONS.RED;
		default:
			return ICONS.BLUE;
	}
}

export default {
	async fetch(request) {
		const url = new URL(request.url);
		if (!/^\/api\/frames\/?$/.test(url.pathname)) {
			return new Response('Not Found', { status: 404 });
		}

		try {
			const apiUrl = `${API_BASE_URL}?${url.searchParams.toString()}`;
			const data = await fetchData(apiUrl);

			if (!data?.unix_seconds?.length || !data?.share?.length || !data?.signal?.length) {
				console.error('No Data:', apiUrl);
				return createErrorResponse('No Data', 200);
			}

			const currentTimestamp = Math.floor(Date.now() / 1000);
			const nearestQuarterHour = getTimestampFloor(data.unix_seconds, currentTimestamp);
			const currentIndex = data.unix_seconds.indexOf(nearestQuarterHour);
			const currentShare = data.share[currentIndex] ?? null;
			const currentSignal = data.signal[currentIndex] ?? null;
			const icon = getIcon(currentSignal);
			const nextShareValues = getHourlyShares(data, currentTimestamp);

			return createFramesResponse(icon, currentShare, currentSignal, nextShareValues);
		} catch (error) {
			console.error('Error:', error);
			return createErrorResponse();
		}
	},
};
