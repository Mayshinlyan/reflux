import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createTestDb } from '@/db/__tests__/testDb';
import { getCachedInsight, insightKey } from '@/db/repositories/insightCache';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { fallbackInsight, insightHash } from '@/lib/insight';
import { logger } from '@/lib/logger';
import { fetchInsight } from '@/services/relayClient';
import type { Insight, InsightRequest } from '@/types/insight';

import { useInsight } from '../useInsight';

let mockDb: AppDb;
let closeDb: () => void;
let mockSummaries = true;
jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({ settings: { summariesEnabled: mockSummaries } }),
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/services/relayClient', () => ({ fetchInsight: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { debug: jest.fn(), error: jest.fn() } }));

const fetchMock = fetchInsight as jest.Mock;

const request: InsightRequest = {
  range: 'day',
  meals: [{ name: 'Spicy chicken tacos', verdict: 'caution', when: '7:45 PM' }],
  symptoms: [],
  tags: [],
};
const ai: Insight = {
  tone: 'nudge',
  bellieLine: 'Easy on the spice tonight?',
  summary: 'Spicy tacos late.',
  tips: ['Have spicy food earlier.'],
};

/** Shows what the hook returns. Each test uses its own `periodKey`, because failures are remembered per day. */
function Probe({ periodKey, req }: { periodKey: string; req: InsightRequest | null }) {
  const insight = useInsight('day', periodKey, req);
  return <Text testID="line">{insight ? insight.bellieLine : 'nothing'}</Text>;
}

beforeEach(() => {
  const created = createTestDb();
  mockDb = created.db;
  closeDb = () => created.sqlite.close();
  mockSummaries = true;
  fetchMock.mockReset();
  jest.mocked(logger.debug).mockClear();
  jest.mocked(logger.error).mockClear();
});
afterEach(() => closeDb());

const line = () => screen.getByTestId('line').props.children;

describe('useInsight', () => {
  it('has nothing to say, and asks for nothing, when nothing is logged', async () => {
    await render(<Probe periodKey="2026-10-01" req={null} />);

    expect(line()).toBe('nothing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows words made on the phone at once, then the AI summary when it arrives, and keeps it', async () => {
    let resolve!: (insight: Insight) => void;
    fetchMock.mockReturnValue(new Promise<Insight>((r) => (resolve = r)));
    await render(<Probe periodKey="2026-10-02" req={request} />);

    expect(line()).toBe(fallbackInsight(request).bellieLine);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(request);

    await act(async () => resolve(ai));

    await waitFor(() => expect(line()).toBe(ai.bellieLine));
    expect(getCachedInsight(mockDb, insightKey('day', '2026-10-02'), insightHash(request))).toEqual(ai);
  });

  it('uses the kept summary without asking again when the logs have not changed', async () => {
    fetchMock.mockResolvedValue(ai);
    const first = await render(<Probe periodKey="2026-10-03" req={request} />);
    await waitFor(() => expect(line()).toBe(ai.bellieLine));
    await first.unmount();
    fetchMock.mockClear();

    await render(<Probe periodKey="2026-10-03" req={{ ...request }} />);

    expect(line()).toBe(ai.bellieLine);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks again when what was logged changes', async () => {
    fetchMock.mockResolvedValue(ai);
    const view = await render(<Probe periodKey="2026-10-04" req={request} />);
    await waitFor(() => expect(line()).toBe(ai.bellieLine));
    fetchMock.mockResolvedValue({ ...ai, bellieLine: 'A calm one now!' });

    await view.rerender(
      <Probe
        periodKey="2026-10-04"
        req={{ ...request, meals: [...request.meals, { name: 'Oatmeal', verdict: 'good', when: '8:00 PM' }] }}
      />,
    );

    await waitFor(() => expect(line()).toBe('A calm one now!'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the local words when the relay cannot be reached, quietly, and does not hammer it', async () => {
    fetchMock.mockRejectedValue(new AppError('OFFLINE'));
    const view = await render(<Probe periodKey="2026-10-05" req={request} />);
    await waitFor(() => expect(logger.debug).toHaveBeenCalledWith('fetchInsight'));

    expect(line()).toBe(fallbackInsight(request).bellieLine);
    expect(logger.error).not.toHaveBeenCalled();

    // Coming back to the screen soon after does not ask again.
    await view.unmount();
    await render(<Probe periodKey="2026-10-05" req={{ ...request }} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a failure that is not an ordinary connection problem', async () => {
    fetchMock.mockRejectedValue(new AppError('AI_INVALID_OUTPUT'));
    await render(<Probe periodKey="2026-10-06" req={request} />);

    await waitFor(() => expect(logger.error).toHaveBeenCalledWith('fetchInsight', expect.any(AppError)));
    expect(line()).toBe(fallbackInsight(request).bellieLine);
  });

  it('stops waiting for an answer when the screen goes away', async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_request: InsightRequest, abort: AbortSignal) => {
      signal = abort;
      return new Promise<Insight>(() => {});
    });
    const view = await render(<Probe periodKey="2026-10-07" req={request} />);

    await view.unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('sends nothing and shows only the words made on the phone when summaries are off', async () => {
    mockSummaries = false;
    fetchMock.mockResolvedValue(ai);
    await render(<Probe periodKey="2026-10-08" req={request} />);

    expect(line()).toBe(fallbackInsight(request).bellieLine);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a summary kept from before they were turned off', async () => {
    fetchMock.mockResolvedValue(ai);
    const view = await render(<Probe periodKey="2026-10-09" req={request} />);
    await waitFor(() => expect(line()).toBe(ai.bellieLine));

    mockSummaries = false;
    await view.rerender(<Probe periodKey="2026-10-09" req={request} />);

    expect(line()).toBe(fallbackInsight(request).bellieLine);
  });
});
