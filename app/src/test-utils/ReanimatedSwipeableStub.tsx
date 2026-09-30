import { forwardRef, type ReactNode, useImperativeHandle } from 'react';
import { View } from 'react-native';

/**
 * Jest stand-in for react-native-gesture-handler's ReanimatedSwipeable (see jest.config.js). Reanimated's
 * native runtime doesn't load in Jest and a swipe can't be simulated, so this renders the row with its
 * revealed action always present, which is also how a screen reader meets it.
 */
const ReanimatedSwipeableStub = forwardRef<
  { close: () => void },
  { children?: ReactNode; renderRightActions?: () => ReactNode }
>(function ReanimatedSwipeableStub({ children, renderRightActions }, ref) {
  useImperativeHandle(ref, () => ({ close: () => {} }));
  return (
    <View>
      {children}
      {renderRightActions?.()}
    </View>
  );
});

export default ReanimatedSwipeableStub;
