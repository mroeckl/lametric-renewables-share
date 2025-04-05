import { fetchMock } from 'cloudflare:test';
import { beforeAll, afterEach, it, expect, describe } from 'vitest';
import * as sut from '../src/index';

const SECS_PER_QUARTER_HOUR = 60 * 15;

describe('getTimestampFloor', () => {
	// Definieren der Zeitstempel einmalig
	const baseTime = new Date(2024, 0, 1, 10, 0, 0).getTime() / 1000;
	const timestamps = [
		baseTime,
		baseTime + 15 * 60, // 10:15
		baseTime + 30 * 60, // 10:30
		baseTime + 45 * 60, // 10:45
	];

	it('should return the same timestamp for the beginning of a quarter hour', () => {
		const targetTimestamp = baseTime;
		expect(sut.getTimestampFloor(timestamps, targetTimestamp)).toBe(baseTime);
	});

	it('should return the timestamp for the beginning of the previous quarter hour', () => {
		const targetTimestamp = baseTime + 29 * 60 + 59; // 10:29:59
		expect(sut.getTimestampFloor(timestamps, targetTimestamp)).toBe(baseTime + 15 * 60);
	});

	it('should return the nearest timestamp for a timestamp in between quarter hours', () => {
		const targetTimestamp = baseTime + 1; // 10:00:01
		expect(sut.getTimestampFloor(timestamps, targetTimestamp)).toBe(baseTime);
	});

	it('should handle an empty array', () => {
		const emptyTimestamps = [];
		const targetTimestamp = 100;
		expect(sut.getTimestampFloor(emptyTimestamps, targetTimestamp)).toBe(-1);
	});
});

describe('createFramesResponse', () => {
	it('should return a Response object with correct structure and data', async () => {
		const icon = '1234';
		const currentShare = 25;
		const currentSignal = 1;
		const nextShareValues = [20, 30, 40];

		const response = sut.createFramesResponse(icon, currentShare, currentSignal, nextShareValues);
		const body = await response.json();

		expect(response).toBeInstanceOf(Response);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(body).toEqual({
			frames: [
				{
					icon: '1234',
					goalData: {
						start: 0,
						current: 25,
						end: 100,
						unit: '%',
						currentSignal: 1,
					},
				},
				{ chartData: [20, 30, 40] },
			],
		});
	});

	it('should handle different input values correctly', async () => {
		const icon = '5678';
		const currentShare = 75;
		const currentSignal = 2;
		const nextShareValues = [50, 60];

		const response = sut.createFramesResponse(icon, currentShare, currentSignal, nextShareValues);
		const body = await response.json();

		expect(body).toEqual({
			frames: [
				{
					icon: '5678',
					goalData: {
						start: 0,
						current: 75,
						end: 100,
						unit: '%',
						currentSignal: 2,
					},
				},
				{ chartData: [50, 60] },
			],
		});
	});

	it('should handle empty nextShareValues array', async () => {
		const icon = '9012';
		const currentShare = 100;
		const currentSignal = 0;
		const nextShareValues = [];

		const response = sut.createFramesResponse(icon, currentShare, currentSignal, nextShareValues);
		const body = await response.json();

		expect(body).toEqual({
			frames: [
				{
					icon: '9012',
					goalData: {
						start: 0,
						current: 100,
						end: 100,
						unit: '%',
						currentSignal: 0,
					},
				},
				{ chartData: [] },
			],
		});
	});
});

describe('getHourlyShares', () => {
	it('should return share value for every hour starting from position 1', () => {
		const data = {
			unix_seconds: Array.from({ length: 10 }, (_, i) => i * SECS_PER_QUARTER_HOUR),
			share: Array.from({ length: 10 }, (_, i) => i),
		};
		const actual = sut.getHourlyShares(data, SECS_PER_QUARTER_HOUR + 1);
		const expected = [1, 5, 9];
		expect(actual).toEqual(expected);
	});

	it('should handle empty input', () => {
		const data = { unix_seconds: [], share: [] };
		const actual = sut.getHourlyShares(data, 0);
		const expected = [];
		expect(actual).toEqual(expected);
	});

	it('should handle invalid start position', () => {
		const data = {
			unix_seconds: Array.from({ length: 3 }, (_, i) => i * SECS_PER_QUARTER_HOUR),
			share: Array.from({ length: 3 }, (_, i) => i),
		};
		const actual = sut.getHourlyShares(data, -1);
		const expected = [];
		expect(actual).toEqual(expected);
	});

	it('should limit output to 10 elements', () => {
		const data = {
			unix_seconds: Array.from({ length: 51 }, (_, i) => i * SECS_PER_QUARTER_HOUR),
			share: Array.from({ length: 51 }, (_, i) => i),
		};
		const actual = sut.getHourlyShares(data, 0);
		const expected = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36];
		expect(actual).toEqual(expected);
	});
});
