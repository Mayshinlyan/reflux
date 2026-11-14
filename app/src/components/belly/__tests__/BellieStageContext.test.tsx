import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BellieStageProvider, useBellieStage } from '../BellieStageContext';

let mockStage: unknown = 'kid';
jest.mock('@/db/DatabaseProvider', () => ({
  useSettings: () => ({ settings: { bellieStageSeen: mockStage } }),
}));

function Show() {
  return <Text>{useBellieStage()}</Text>;
}

describe('BellieStageProvider', () => {
  it('gives the stage that was seen', async () => {
    mockStage = 'teenager';
    await render(
      <BellieStageProvider>
        <Show />
      </BellieStageProvider>,
    );
    expect(screen.getByText('teenager')).toBeTruthy();
  });

  it('treats a stored value that is not a stage as a Baby', async () => {
    mockStage = 'toddler';
    await render(
      <BellieStageProvider>
        <Show />
      </BellieStageProvider>,
    );
    expect(screen.getByText('baby')).toBeTruthy();
  });

  it('is the Little without a provider, the everyday Bellie', async () => {
    await render(<Show />);
    expect(screen.getByText('little')).toBeTruthy();
  });
});
