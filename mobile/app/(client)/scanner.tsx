import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';
import { getFoodByBarcode, type FoodSummary } from '../../src/api/foods';
import { FoodDetailSheet } from '../../src/components/FoodDetailSheet';
import { AxiosError } from 'axios';

const SCAN_AREA_WIDTH = 280;
const SCAN_AREA_HEIGHT = 180;

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [food, setFood] = useState<FoodSummary | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBarCodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);
      setLoading(true);
      setErrorMessage(null);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const foodData = await getFoodByBarcode(result.data);
        setFood(foodData);
        setSheetVisible(true);
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) {
          setErrorMessage(`Food not found for barcode ${result.data}`);
        } else {
          setErrorMessage('Failed to look up barcode. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [scanned],
  );

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
    setFood(null);
    setScanned(false);
  }, []);

  const handleDismissError = useCallback(() => {
    setErrorMessage(null);
    setScanned(false);
  }, []);

  // Permission not yet determined
  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.dark.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan barcodes on food packages.
          </Text>
          {permission.canAskAgain ? (
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.permissionButton}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Camera view with scanner
  return (
    <View style={styles.fullscreen}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Top bar */}
        <SafeAreaView edges={['top']} style={styles.topBarSafe}>
          <TopBar onBack={() => router.back()} light />
        </SafeAreaView>

        {/* Scanning overlay with cutout */}
        <View style={styles.overlayCenter} pointerEvents="box-none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddleRow}>
            <View style={styles.overlaySide} />
            <View style={styles.scanArea}>
              {loading && (
                <ActivityIndicator
                  color={Colors.dark.gold}
                  size="large"
                  style={styles.scanLoader}
                />
              )}
              {/* Corner decorations */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.instructionText}>
              {loading ? 'Looking up product...' : 'Point camera at a barcode'}
            </Text>
          </View>
        </View>

        {/* Error overlay */}
        {errorMessage && (
          <View style={styles.errorOverlay}>
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Not Found</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable style={styles.errorButton} onPress={handleDismissError}>
                <Text style={styles.errorButtonText}>Scan Again</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Food detail sheet */}
      <FoodDetailSheet
        food={food}
        visible={sheetVisible}
        onClose={handleCloseSheet}
      />
    </View>
  );
}

function TopBar({ onBack, light }: { onBack: () => void; light?: boolean }) {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
        <Text style={[styles.backArrow, light && styles.backArrowLight]}>←</Text>
      </Pressable>
      <Text style={[styles.topBarTitle, light && styles.topBarTitleLight]}>
        Scan Barcode
      </Text>
      <View style={styles.backButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Top bar
  topBarSafe: {
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  backArrowLight: {
    color: '#fff',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  topBarTitleLight: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Overlay
  overlayCenter: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddleRow: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanArea: {
    width: SCAN_AREA_WIDTH,
    height: SCAN_AREA_HEIGHT,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLoader: {
    position: 'absolute',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 24,
  },
  instructionText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },

  // Corner decorations
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Colors.dark.gold,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },

  // Permission screen
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: Colors.dark.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
  },
  permissionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.background,
  },

  // Error overlay
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
  },
  errorButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.background,
  },
});
