import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Alert, TextInput, Modal, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useStore, addToShoppingList, removeFromShoppingList, updateShoppingItem, markShoppingItemBought, moveBoughtToPantry, showSnackbar, setShoppingList } from '../services/store'
import { ListItem } from '../components/ListItem'
import { EmptyState } from '../components/EmptyState'

export default function ShoppingList() {
  const { state, dispatch } = useStore()
  const [editingItem, setEditingItem] = useState(null)
  const [editQty, setEditQty] = useState('')

  const clickCheck = useCallback((itemId) => {
    const item = state.shoppingList.find((item) => item.id === itemId)
    if (item) {
      dispatch(markShoppingItemBought(itemId, !item.bought))
    }
  }, [state.shoppingList, dispatch])

  const clickRemove = useCallback((itemId) => {
    dispatch(removeFromShoppingList(itemId))
  }, [dispatch])

  const clickEdit = useCallback((item) => {
    setEditingItem(item)
    setEditQty(item.qty?.toString() || '')
  }, [])

  const clickSave = useCallback(() => {
    if (editingItem) {
      dispatch(updateShoppingItem({
        ...editingItem,
        qty: editQty,
      }))
      setEditingItem(null)
      setEditQty('')
    }
  }, [editQty, editingItem, dispatch])

  const clickCancel = useCallback(() => {
    setEditingItem(null)
    setEditQty('')
  }, [])

  const clickMoveToPantry = useCallback(() => {
    const boughtItems = state.shoppingList.filter((item) => item.bought)
    if (boughtItems.length === 0) {
      if (Platform.OS === 'web') {
        alert('Mark items as bought first to move them to your pantry.')
      } else {
        Alert.alert('No Items', 'Mark items as bought first to move them to your pantry.')
      }
      return
    }

    if (Platform.OS === 'web') {
      if (window.confirm(`Move ${boughtItems.length} bought items to your pantry and remove them from shopping list?`)) {
        dispatch(moveBoughtToPantry())
        alert(`Moved ${boughtItems.length} items to your pantry!`)
      }
      return
    }

    Alert.alert(
      'Move to Pantry',
      `Move ${boughtItems.length} bought items to your pantry and remove them from shopping list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: () => {
            dispatch(moveBoughtToPantry())
            Alert.alert('Success', `Moved ${boughtItems.length} items to your pantry!`)
          },
        },
      ]
    )
  }, [state.shoppingList, dispatch])

  const clickClear = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to remove all items from your shopping list?')) {
        dispatch(setShoppingList([]))
      }
      return
    }
    Alert.alert(
      'Clear Shopping List',
      'Are you sure you want to remove all items from your shopping list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => dispatch(setShoppingList([])),
        },
      ]
    )
  }, [dispatch])

  const showItem = ({ item }) => {
    const quantityText = item.qty && item.unit ? `${item.qty} ${item.unit}` : item.qty || ''
    const subtitle = quantityText

    return (
      <ListItem
        title={item.name}
        subtitle={subtitle}
        showCheckbox={true}
        checked={item.bought}
        onToggleCheck={() => clickCheck(item.id)}
        rightIcon={
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => clickEdit(item)}>
              <Ionicons name="create-outline" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => clickRemove(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        }
        style={[
          styles.item,
          item.bought && styles.boughtItem,
        ]}
        titleStyle={[
          item.bought && styles.boughtText,
        ]}
        subtitleStyle={[
          item.bought && styles.boughtText,
        ]}
      />
    )
  }

  const showTop = () => {
    const totalItems = state.shoppingList.length
    const boughtItems = state.shoppingList.filter((item) => item.bought).length
    const remainingItems = totalItems - boughtItems

    return (
      <View style={styles.top}>
        <Text style={styles.title}>Shopping List</Text>
        <Text style={styles.sub}>
          {totalItems === 0 ? 'No items' : `${remainingItems} remaining • ${boughtItems} bought`}
        </Text>
        {totalItems > 0 && (
          <View style={styles.buttons}>
            {boughtItems > 0 && (
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={clickMoveToPantry}>
                <Text style={styles.moveBtnText}>
                  Move to Pantry ({boughtItems})
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={clickClear}>
              <Text style={styles.clearBtnText}>Clear List</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }


  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      {state.shoppingList.length > 0 ? (
        <FlatList
          data={state.shoppingList}
          renderItem={showItem}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          ListHeaderComponent={showTop}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list} />
      ) : (
        <View style={styles.main}>
          {showTop()}
          <EmptyState
            icon="list-outline"
            title="Your shopping list is empty"
            description="Add missing ingredients from recipes to build your shopping list" />
        </View>
      )}

      <Modal
        visible={editingItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={clickCancel}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem?.name}</Text>

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalLabel}>Quantity</Text>
              <TextInput
                style={styles.modalInput}
                value={editQty}
                onChangeText={(text) => setEditQty(text.replace(/[^0-9.]/g, ''))}
                placeholder="2"
                keyboardType="numeric"
                autoFocus={true}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={clickCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={clickSave}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  top: {
    backgroundColor: 'white',
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sub: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  buttons: {
    paddingHorizontal: 16,
    gap: 8,
  },
  moveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
  },
  moveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearBtnText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: 'white',
  },
  boughtItem: {
    backgroundColor: '#f8f9fa',
    opacity: 0.7,
  },
  boughtText: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInputContainer: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
})
