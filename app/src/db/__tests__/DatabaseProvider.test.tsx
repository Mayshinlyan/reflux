import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { DatabaseProvider } from '../DatabaseProvider';

const mockInit = jest.fn();
jest.mock('../client', () => ({
  initDatabase: () => mockInit(),
  getDb: () => ({}),
}));
jest.mock('../repositories/settings', () => ({
  getAllSettings: () => ({}),
  setSetting: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));

describe('DatabaseProvider', () => {
  beforeEach(() => mockInit.mockReset());

  it('shows the error view with a retry, and opens the app when the second try works', async () => {
    mockInit.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
    await render(
      <DatabaseProvider
        fallback={<Text>loading</Text>}
        errorView={(retry) => (
          <Pressable accessibilityRole="button" onPress={retry}>
            <Text>Try again</Text>
          </Pressable>
        )}>
        <Text>the app</Text>
      </DatabaseProvider>,
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('the app')).toBeTruthy();
    expect(mockInit).toHaveBeenCalledTimes(2);
  });

  it('still takes a plain element as the error view', async () => {
    mockInit.mockRejectedValue(new Error('disk full'));
    await render(
      <DatabaseProvider fallback={null} errorView={<Text>broken</Text>}>
        <Text>the app</Text>
      </DatabaseProvider>,
    );

    expect(await screen.findByText('broken')).toBeTruthy();
  });
});
