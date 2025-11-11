import React, {useState, useCallback} from 'react'
import {View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert} from 'react-native'
import {Ionicons} from '@expo/vector-icons'

export const IngredientConfirmationDialog = ({visible, ingredients, onConfirm, onCancel}) => {
  const [selectedItems, setSelectedItems] = useState(new Set(ingredients))
  const [customItem, setCustomItem] = useState('')

  // Update selected items when ingredients prop changes
  React.useEffect(() => {
    setSelectedItems(new Set(ingredients))
  }, [ingredients])

  const toggleItem = useCallback((item) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(item)) {
        newSet.delete(item)
      } else {
        newSet.add(item)
      }
      return newSet
    })
  }, [])

  const addCustomItem = useCallback(() => {
    const trimmed = customItem.trim().toLowerCase()
    if (trimmed) {
      setSelectedItems(prev => new Set([...prev, trimmed]))
      setCustomItem('')
    }
  }, [customItem])

  const handleConfirm = useCallback(() => {
    const selected = Array.from(selectedItems)
    if (selected.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one ingredient to add to your pantry.')
      return
    }
    onConfirm(selected)
    setCustomItem('')
  }, [selectedItems, onConfirm])

  const handleCancel = useCallback(() => {
    setCustomItem('')
    onCancel()
  }, [onCancel])

  const allItems = [...new Set([...ingredients, ...selectedItems])].sort()

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Detected Ingredients</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Select ingredients to add to your pantry
          </Text>

          {/* Items List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {allItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No ingredients detected</Text>
                <Text style={styles.emptySubtext}>Try adding items manually below</Text>
              </View>
            ) : (
              allItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.item}
                  onPress={() => toggleItem(item)}>
                  <View style={styles.itemLeft}>
                    <View style={[
                      styles.checkbox,
                      selectedItems.has(item) && styles.checkboxChecked
                    ]}>
                      {selectedItems.has(item) && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </View>
                    <Text style={[
                      styles.itemText,
                      selectedItems.has(item) && styles.itemTextChecked
                    ]}>
                      {item}
                    </Text>
                  </View>
                  {!ingredients.includes(item) && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Custom</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Add Custom Item */}
          <View style={styles.addCustom}>
            <TextInput
              style={styles.customInput}
              placeholder="Add custom ingredient..."
              value={customItem}
              onChangeText={setCustomItem}
              onSubmitEditing={addCustomItem}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={addCustomItem}
              disabled={!customItem.trim()}>
              <Ionicons
                name="add-circle"
                size={28}
                color={customItem.trim() ? "#007AFF" : "#ccc"}
              />
            </TouchableOpacity>
          </View>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>
                Add {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    maxHeight: 300,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  itemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  itemTextChecked: {
    fontWeight: '500',
  },
  customBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  customBadgeText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  addCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  customInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#f8f9fa',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 15,
    marginRight: 8,
  },
  addBtn: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
})

