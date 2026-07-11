import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type, interFamily } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import type { TrainingSession } from '@/api/training'
import type { SessionCtaState } from './trainingCardHelpers'

// ─── SessionCtaFooter ─────────────────────────────────────────────────────────

export interface SessionCtaFooterProps {
  session: TrainingSession
  state: SessionCtaState
  isPending: boolean
  onPress: (session: TrainingSession, state: SessionCtaState) => void
  /**
   * When true, another session is currently live. The CTA is rendered
   * disabled with a "Session already in progress" label. The not-locked
   * code path is not affected.
   */
  locked?: boolean
}

export function SessionCtaFooter({ session, state, isPending, onPress, locked = false }: SessionCtaFooterProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const isDisabled = isPending || locked

  return (
    <View style={[ctaStyles.footerButton, { borderTopColor: colors.sep2 }]}>
      <Pressable
        onPress={() => {
          if (!isDisabled) onPress(session, state)
        }}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={locked ? t('today.trainingCta.sessionInProgress') : undefined}
        style={({ pressed }) => [
          ctaStyles.primaryButton,
          locked
            ? { backgroundColor: colors.bg3, opacity: 0.7 }
            : { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {isPending && !locked ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Text
            style={[
              ctaStyles.primaryLabel,
              locked ? { color: colors.label3 } : { color: colors.onAccent },
            ]}
          >
            {locked
              ? t('today.trainingCta.sessionInProgress')
              : state === 'in-progress'
                ? t('today.trainingCta.continue')
                : t('today.trainingCta.start')}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const ctaStyles = StyleSheet.create({
  footerButton: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    // Hairline above the CTA so the boundary between the last exercise row
    // and the action zone is unambiguous.
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryButton: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryLabel: {
    ...Type.callout,
    fontFamily: interFamily('700'),
    fontWeight: '700',
  },
})

export default SessionCtaFooter
