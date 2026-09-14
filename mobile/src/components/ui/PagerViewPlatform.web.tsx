import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  Children,
  useCallback,
  type ReactElement,
} from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
  ({ initialPage = 0, onPageSelected, style, children }, ref) => {
    const scrollRef = useRef<ScrollView>(null);
    const pages = Children.toArray(children);
    const [containerWidth, setContainerWidth] = useState<number | null>(null);
    const windowWidth = useWindowDimensions().width;
    const width = containerWidth ?? windowWidth;
    const lastReportedPageRef = useRef(initialPage);

    useImperativeHandle(
      ref,
      () => ({
        setPage: (page: number) => {
          scrollRef.current?.scrollTo({ x: page * width, animated: true });
        },
      }),
      [width],
    );

    useEffect(() => {
      if (containerWidth == null) return;
      scrollRef.current?.scrollTo({ x: initialPage * containerWidth, animated: false });
      lastReportedPageRef.current = initialPage;
    }, [containerWidth, initialPage]);

    const handleMomentumScrollEnd = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const position = Math.round(e.nativeEvent.contentOffset.x / (width || 1));
        if (position !== lastReportedPageRef.current) {
          lastReportedPageRef.current = position;
          onPageSelected?.({ nativeEvent: { position } });
        }
      },
      [onPageSelected, width],
    );

    return (
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={style}
      >
        {pages.map((page, index) => (
          <View key={index} style={{ width }}>
            {page}
          </View>
        ))}
      </ScrollView>
    );
  },
);

PagerViewPlatform.displayName = 'PagerViewPlatform';

export default PagerViewPlatform;
