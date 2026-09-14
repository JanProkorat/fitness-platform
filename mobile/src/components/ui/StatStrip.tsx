import React, { ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'

interface StatStripProps {
  children: ReactNode
}

export function StatStrip({ children }: StatStripProps) {
  return <View style={styles.strip}>{children}</View>
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
  },
})

export default StatStrip
