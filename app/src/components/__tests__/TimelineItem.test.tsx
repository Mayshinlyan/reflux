import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TimelineItem } from '../TimelineItem';

// Render each icon as its name so the test can tell which one a row uses.
jest.mock('lucide-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: MockText } = require('react-native');
  return new Proxy({}, { get: (_target, name) => () => <MockText>{`icon:${String(name)}`}</MockText> });
});

describe('TimelineItem icons', () => {
  const row = (kind: 'symptom' | 'food' | 'medication') => (
    <TimelineItem kind={kind} title="Something" time="8:00 AM" onPress={() => {}} side={<Text />} />
  );

  it('uses the carrot for a meal, not the camera (the camera means Scan)', async () => {
    await render(row('food'));

    expect(screen.getByText('icon:Carrot')).toBeTruthy();
    expect(screen.queryByText('icon:Camera')).toBeNull();
  });

  it('keeps distinct icons for symptoms and medications', async () => {
    await render(row('symptom'));
    expect(screen.getByText('icon:Activity')).toBeTruthy();

    await screen.unmount();
    await render(row('medication'));
    expect(screen.getByText('icon:Pill')).toBeTruthy();
  });
});
