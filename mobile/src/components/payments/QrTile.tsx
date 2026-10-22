import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type QrTileProps = {
  /** The QR Platba (SPAYD) payload; rendered, never logged or stored. */
  payload: string;
  accessibilityLabel: string;
};

/** The payment QR code on a white tile so it scans in dark mode too. */
export function QrTile({ payload, accessibilityLabel }: QrTileProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.tile}>
      <QRCode
        value={payload}
        size={theme.sizes.qrCode}
        quietZone={theme.spacing.xs}
        color={theme.colors.qrInk}
        backgroundColor={theme.colors.qrTile}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    tile: {
      alignSelf: 'center',
      overflow: 'hidden',
      borderRadius: theme.radii.sm,
      backgroundColor: theme.colors.qrTile,
    },
  });
