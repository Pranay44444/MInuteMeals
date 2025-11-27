import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export const EmptyState = ({ icon = "document-outline", title = "Nothing here yet", description = "Add some items to get started", actionText, onActionPress, style }) => {
  const showDescription = description
  const showButton = actionText && onActionPress

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={64} color="#ccc" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {showDescription && (
        <Text style={styles.descriptionText}>{description}</Text>
      )}
      {showButton && (
        <TouchableOpacity style={styles.actionButton} onPress={onActionPress}>
          <Text style={styles.actionButtonText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64
  },
  iconContainer: {
    marginBottom: 24
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8
  },
  descriptionText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
})
