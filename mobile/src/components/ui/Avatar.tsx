import React from 'react'
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { getInitials } from '@/lib/initials'
import { useImagePicker } from '@/hooks/useImagePicker'
import { useTranslation } from 'react-i18next'

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
] as const

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeMap: Record<AvatarSize, { container: number; radius: number; fontSize: number; badgeSize: number; badgeIcon: number }> = {
  sm: { container: 36, radius: Radius.sm, fontSize: 12, badgeSize: 18, badgeIcon: 10 },
  md: { container: 56, radius: 18, fontSize: 17, badgeSize: 22, badgeIcon: 12 },
  lg: { container: 80, radius: 26, fontSize: 28, badgeSize: 28, badgeIcon: 14 },
  xl: { container: 100, radius: 32, fontSize: 36, badgeSize: 32, badgeIcon: 16 },
}

export interface AvatarProps {
  /** Display name — used for initials fallback and colour derivation. */
  name: string
  size?: AvatarSize
  /** Explicit background colour for the initials avatar. If omitted, derived from name. */
  color?: string
  /** Remote image URL. When truthy, renders an `<Image>` instead of initials. */
  imageUrl?: string | null
  /** Show the camera-badge overlay (own-profile use case only). */
  editable?: boolean
  /**
   * Called when the user taps the camera badge.
   * Must return a `{ uploadUrl, blobUrl }` pair from the backend.
   */
  onRequestUpload?: (args: { contentType: string; sizeBytes: number }) => Promise<{ uploadUrl: string; blobUrl: string }>
  /** Called after the upload completes successfully, with the permanent blob URL. */
  onUploaded?: (blobUrl: string) => void
}

function getColorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Internal component rendering the camera-badge overlay. */
function CameraBadge({
  size,
  onPress,
  uploading,
}: {
  size: AvatarSize
  onPress: () => void
  uploading: boolean
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const { badgeSize, badgeIcon } = sizeMap[size]
  const offset = -(badgeSize / 4)

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={t('avatar.editBadgeLabel')}
      accessibilityHint={t('avatar.editBadgeHint')}
      style={[
        styles.badge,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: colors.gold,
          borderColor: colors.bg,
          right: offset,
          bottom: offset,
        },
      ]}
    >
      {uploading ? (
        <ActivityIndicator size="small" color={colors.onAccent} />
      ) : (
        <Ionicons name="camera" size={badgeIcon} color={colors.onAccent} />
      )}
    </Pressable>
  )
}

/**
 * Avatar primitive.
 *
 * - Renders a remote image when `imageUrl` is provided (initials fallback otherwise).
 * - Shows a gold camera badge when `editable` is true.
 * - Badge taps drive `useImagePicker` → `onRequestUpload` → `onUploaded`.
 */
export function Avatar({
  name,
  size = 'md',
  color,
  imageUrl,
  editable = false,
  onRequestUpload,
  onUploaded,
}: AvatarProps) {
  const colors = useTheme()
  const { container, radius, fontSize } = sizeMap[size]
  const bgColor = color ?? getColorForName(name)

  const requestUploadUrl = onRequestUpload ?? (async () => ({ uploadUrl: '', blobUrl: '' }))
  const handleUploaded = onUploaded ?? (() => {})

  const { pick, uploading } = useImagePicker(
    {
      source: 'both',
      aspect: [1, 1],
      requestUploadUrl: requestUploadUrl,
    },
    handleUploaded,
  )

  const inner = imageUrl ? (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.image, { width: container, height: container, borderRadius: radius }]}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View
      style={[styles.container, { width: container, height: container, borderRadius: radius, backgroundColor: bgColor }]}
    >
      <Text style={[styles.initials, { fontSize, color: colors.bg2 }]}>
        {getInitials(name)}
      </Text>
    </View>
  )

  if (!editable) {
    return inner
  }

  return (
    <View style={styles.editableWrap}>
      {inner}
      <CameraBadge size={size} onPress={pick} uploading={uploading} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontWeight: '700',
  },
  editableWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
})

export default Avatar
