import { forwardRef, type ReactElement, type Ref } from 'react';
import type { ViewStyle, StyleProp } from 'react-native';
import RNPagerView from 'react-native-pager-view';

export interface PagerViewPlatformProps {
  initialPage?: number;
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactElement | ReactElement[];
}

export interface PagerViewPlatformHandle {
  setPage: (page: number) => void;
}

const PagerViewPlatform = forwardRef<PagerViewPlatformHandle, PagerViewPlatformProps>(
  ({ initialPage, onPageSelected, style, children }, ref) => (
    <RNPagerView
      ref={ref as Ref<RNPagerView>}
      initialPage={initialPage}
      onPageSelected={onPageSelected}
      style={style}
    >
      {children}
    </RNPagerView>
  ),
);

PagerViewPlatform.displayName = 'PagerViewPlatform';

export default PagerViewPlatform;
