import type { ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton } from '@/components/profile/GlassButton';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ImageViewerProps = {
  /** The image to show; the viewer is closed while this is null. */
  uri: string | null;
  imageLabel: string;
  closeLabel: string;
  onClose: () => void;
  /** Extra controls rendered at the right of the top bar. */
  actions?: ReactNode;
  /** Optional line centred under the image. */
  caption?: ReactNode;
};

/** Full-screen image, scaled to fit, with a close button. */
export function ImageViewer({ uri, imageLabel, closeLabel, onClose, actions, caption }: ImageViewerProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={uri !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="contain" accessibilityLabel={imageLabel} />
        ) : null}
        <View style={[styles.topBar, { top: insets.top + theme.spacing.xs }]}>
          <GlassButton label={closeLabel} onPress={onClose}>
            <SymbolView name="xmark" tintColor={theme.colors.ink} size={theme.sizes.backIcon} />
          </GlassButton>
          {actions}
        </View>
        {uri && caption ? (
          <View style={[styles.caption, { bottom: insets.bottom + theme.spacing.xl }]}>{caption}</View>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    image: {
      flex: 1,
    },
    topBar: {
      position: 'absolute',
      left: theme.spacing.xl,
      right: theme.spacing.xl,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    caption: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
  });
