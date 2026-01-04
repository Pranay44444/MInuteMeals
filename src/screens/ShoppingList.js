import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Alert, TextInput, Modal, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useStore, removeFromShoppingList, updateShoppingItem, markShoppingItemBought, moveBoughtToPantry, setShoppingList } from '../services/store'
import { ListItem } from '../components/ListItem'
import { EmptyState } from '../components/EmptyState'

export default function ShoppingList() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState(null)
  const [qty, setQty] = useState('')

  const onCheck = useCallback((id) => {
    const item = state.shoppingList.find(i => i.id === id)
    if (item) dispatch(markShoppingItemBought(id, !item.bought))
  }, [state.shoppingList, dispatch])

  const onRemove = useCallback((id) => dispatch(removeFromShoppingList(id)), [dispatch])

  const onEdit = useCallback((item) => {
    setEditing(item)
    setQty(item.qty?.toString() || '')
  }, [])

  const onSave = useCallback(() => {
    if (editing) {
      dispatch(updateShoppingItem({ ...editing, qty }))
      setEditing(null)
      setQty('')
    }
  }, [qty, editing, dispatch])

  const onCancel = useCallback(() => {
    setEditing(null)
    setQty('')
  }, [])

  const onMoveToPantry = useCallback(() => {
    const bought = state.shoppingList.filter(i => i.bought)
    if (bought.length === 0) {
      Platform.OS === 'web' ? alert('Mark items as bought first.') : Alert.alert('No Items', 'Mark items as bought first.')
      return
    }
    if (Platform.OS === 'web') {
      if (window.confirm(`Move ${bought.length} items to pantry?`)) {
        dispatch(moveBoughtToPantry())
        alert(`Moved ${bought.length} items!`)
      }
      return
    }
    Alert.alert('Move to Pantry', `Move ${bought.length} items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Move', onPress: () => { dispatch(moveBoughtToPantry()); Alert.alert('Success', `Moved ${bought.length} items!`) } }
    ])
  }, [state.shoppingList, dispatch])

  const onClear = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Clear all items?')) dispatch(setShoppingList([]))
      return
    }
    Alert.alert('Clear List', 'Remove all items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => dispatch(setShoppingList([])) }
    ])
  }, [dispatch])

  const Item = ({ item }) => {
    const sub = item.qty && item.unit ? `${item.qty} ${item.unit}` : item.qty || ''
    return (
      <ListItem
        title={item.name}
        subtitle={sub}
        showCheckbox={true}
        checked={item.bought}
        onToggleCheck={() => onCheck(item.id)}
        rightIcon={
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}><Ionicons name="create-outline" size={20} color="#666" /></TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onRemove(item.id)}><Ionicons name="trash-outline" size={20} color="#FF3B30" /></TouchableOpacity>
          </View>
        }
        style={[styles.item, item.bought && styles.bought]}
        titleStyle={item.bought && styles.strike}
        subtitleStyle={item.bought && styles.strike}
      />
    )
  }

  const Header = () => {
    const total = state.shoppingList.length
    const bought = state.shoppingList.filter(i => i.bought).length
    const left = total - bought
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Shopping List</Text>
        <Text style={styles.count}>{total === 0 ? 'No items' : `${left} remaining • ${bought} bought`}</Text>
        {total > 0 && (
          <View style={styles.btns}>
            {bought > 0 && (
              <TouchableOpacity style={styles.moveBtn} onPress={onMoveToPantry}>
                <Text style={styles.moveTxt}>Move to Pantry ({bought})</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
              <Text style={styles.clearTxt}>Clear List</Text>
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
        <FlatList data={state.shoppingList} renderItem={Item} keyExtractor={(i, idx) => `${i.id}_${idx}`} ListHeaderComponent={Header} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} />
      ) : (
        <View style={styles.main}>
          <Header />
          <EmptyState icon="list-outline" title="Your shopping list is empty" description="Add missing ingredients from recipes" />
        </View>
      )}

      <Modal visible={editing !== null} transparent={true} animationType="fade" onRequestClose={onCancel}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editing?.name}</Text>
            <View style={styles.inputBox}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} value={qty} onChangeText={t => setQty(t.replace(/[^0-9.]/g, ''))} placeholder="2" keyboardType="numeric" autoFocus={true} />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={onSave}><Text style={styles.saveTxt}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { backgroundColor: 'white', paddingTop: 16, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', paddingHorizontal: 16, marginBottom: 4 },
  count: { fontSize: 16, color: '#666', paddingHorizontal: 16, marginBottom: 16 },
  btns: { paddingHorizontal: 16, gap: 8 },
  moveBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8 },
  moveTxt: { color: 'white', fontSize: 16, fontWeight: '600' },
  clearBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff5f5', paddingVertical: 10, borderRadius: 8 },
  clearTxt: { color: '#dc3545', fontSize: 14, fontWeight: '500' },
  list: { paddingBottom: 20 },
  item: { backgroundColor: 'white' },
  bought: { backgroundColor: '#f8f9fa', opacity: 0.7 },
  strike: { textDecorationLine: 'line-through', opacity: 0.5 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 20, textAlign: 'center' },
  inputBox: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '500', color: '#666', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f8f9fa' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelTxt: { fontSize: 16, fontWeight: '600', color: '#666' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#007AFF', alignItems: 'center' },
  saveTxt: { fontSize: 16, fontWeight: '600', color: 'white' }
})
