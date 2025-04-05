import { fetchMock } from 'cloudflare:test';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, afterEach, it, expect, describe } from 'vitest';
import sut from '../src';

const API_BASE_URL = 'https://api.energy-charts.info';
const API_PATH = '/signal';
const DEFAULT_COUNTRY = 'de';

const ICON_ERROR = '1692';
const ICON_SUCCESS = '11969';

const TEXT_ERROR = 'Error';
const TEXT_NO_DATA = 'No Data';

const SECS_PER_QUARTER_HOUR = 60 * 15;
const TWENTY_MINS_AGO = new Date(Date.now() - 20 * 60 * 1000);

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

async function executeWorkerRequest(url = `http://example.com/api/frames?country=de`) {
	const request = new Request(url);
	const ctx = createExecutionContext();
	const response = await sut.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('integration tests', () => {
	it('should return a valid response', async () => {
		const data = {
			unix_seconds: Array.from({ length: 8 * 4 }, (_, i) => TWENTY_MINS_AGO.getTime() / 1000 + i * SECS_PER_QUARTER_HOUR),
			share: Array.from({ length: 8 * 4 }, (_, i) => i),
			signal: Array.from({ length: 8 * 4 }, (_, i) => i % 3),
		};
		fetchMock
			.get(API_BASE_URL)
			.intercept({ path: `${API_PATH}?country=${DEFAULT_COUNTRY}` })
			.reply(200, data);

		const response = await executeWorkerRequest();

		const expectedResponse = {
			frames: [
				{
					icon: ICON_SUCCESS,
					goalData: {
						start: 0,
						current: 1,
						end: 100,
						unit: '%',
						currentSignal: 1,
					},
				},
				{
					chartData: [1, 5, 9, 13, 17, 21, 25, 29],
				},
			],
		};

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(expectedResponse);
	});

	it('should return a valid frame response if data is empty', async () => {
		const data = {
			unix_seconds: [],
			share: [],
			signal: [],
		};
		fetchMock
			.get(API_BASE_URL)
			.intercept({ path: `${API_PATH}?country=${DEFAULT_COUNTRY}` })
			.reply(200, data);

		const response = await executeWorkerRequest();

		const expectedResponse = {
			frames: [
				{
					icon: ICON_ERROR,
					text: TEXT_NO_DATA,
				},
			],
		};

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(expectedResponse);
	});

	it('should return an error response if external API call fails', async () => {
		fetchMock
			.get(API_BASE_URL)
			.intercept({ path: `${API_PATH}?country=${DEFAULT_COUNTRY}` })
			.reply(500);

		const response = await executeWorkerRequest();

		const expectedResponse = {
			frames: [
				{
					icon: ICON_ERROR,
					text: TEXT_ERROR,
				},
			],
		};

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual(expectedResponse);
	});
});
