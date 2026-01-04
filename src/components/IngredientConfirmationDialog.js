import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COMMON_INGREDIENTS } from '../constants/ingredients'

export const IngredientConfirmationDialog = ({ visible, ingredients, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState(new Set(ingredients))
  const [custom, setCustom] = useState('')
  const [hints, setHints] = useState([])
  const [showHints, setShowHints] = useState(false)

  useEffect(() => { setSelected(new Set(ingredients)) }, [ingredients])

  const toggle = useCallback((item) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(item) ? s.delete(item) : s.add(item)
      return s
    })
  }, [])

  const addCustom = useCallback(() => {
    const t = custom.trim().toLowerCase()
    if (t) {
      setSelected(prev => new Set([...prev, t]))
      setCustom('')
      setHints([])
      setShowHints(false)
    }
  }, [custom])

  const onInput = useCallback((text) => {
    setCustom(text)
    if (text.trim().length > 0) {
      const f = COMMON_INGREDIENTS.filter(i => i.toLowerCase().startsWith(text.toLowerCase()) && !ingredients.includes(i) && !selected.has(i)).slice(0, 5)
      setHints(f)
      setShowHints(f.length > 0)
    } else {
      setHints([])
      setShowHints(false)
    }
  }, [ingredients, selected])

  const pickHint = useCallback((item) => {
    setSelected(prev => new Set([...prev, item]))
    setCustom('')
    setHints([])
    setShowHints(false)
  }, [])

  const onOk = useCallback(() => {
    const items = Array.from(selected)
    if (items.length === 0) { Alert.alert('No Items', 'Select at least one ingredient.'); return }
    onConfirm(items)
    setCustom('')
  }, [selected, onConfirm])

  const onClose = useCallback(() => { setCustom(''); onCancel() }, [onCancel])

  const allItems = [...new Set([...ingredients, ...selected])].sort()

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>Detected Ingredients</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={24} color="#666" /></TouchableOpacity>
          </View>
          <Text style={styles.sub}>Select ingredients to add to your pantry</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
            {allItems.length === 0 ? (
              <View style={styles.empty}><Ionicons name="alert-circle-outline" size={48} color="#ccc" /><Text style={styles.emptyText}>No ingredients detected</Text><Text style={styles.emptySub}>Add items manually below</Text></View>
            ) : (
              allItems.map((item, i) => (
                <TouchableOpacity key={i} style={styles.item} onPress={() => toggle(item)}>
                  <View style={styles.left}>
                    <View style={[styles.check, selected.has(item) && styles.checked]}>{selected.has(item) && <Ionicons name="checkmark" size={16} color="white" />}</View>
                    <Text style={[styles.itemText, selected.has(item) && styles.checkedText]}>{item}</Text>
                  </View>
                  {!ingredients.includes(item) && <View style={styles.badge}><Text style={styles.badgeText}>Custom</Text></View>}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          {showHints && (
            <ScrollView style={styles.hints} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
              {hints.map((item, i) => <TouchableOpacity key={i} style={styles.hint} onPress={() => pickHint(item)}><Ionicons name="add" size={16} color="#007AFF" /><Text style={styles.hintText}>{item}</Text></TouchableOpacity>)}
            </ScrollView>
          )}
          <View style={styles.addRow}>
            <TextInput style={styles.input} placeholder="Add custom ingredient..." placeholderTextColor="#999" value={custom} onChangeText={onInput} onSubmitEditing={addCustom} returnKeyType="done" />
            <TouchableOpacity style={styles.addBtn} onPress={addCustom} disabled={!custom.trim()}><Ionicons name="add-circle" size={28} color={custom.trim() ? "#007AFF" : "#ccc"} /></TouchableOpacity>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.okBtn} onPress={onOk}><Text style={styles.okText}>Add {selected.size} Item{selected.size !== 1 ? 's' : ''}</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  dialog: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  closeBtn: { padding: 4 },
  sub: { fontSize: 14, color: '#666', paddingHorizontal: 20, marginBottom: 16 },
  list: { maxHeight: 300, paddingHorizontal: 20 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#bbb', marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#ddd', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  itemText: { fontSize: 16, color: '#333', flex: 1 },
  checkedText: { fontWeight: '500' },
  badge: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, color: '#666', fontWeight: '500' },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 8 },
  input: { flex: 1, height: 44, backgroundColor: '#f8f9fa', borderRadius: 22, paddingHorizontal: 16, fontSize: 15, marginRight: 8 },
  addBtn: { padding: 4 },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#666' },
  okBtn: { flex: 2, height: 48, borderRadius: 24, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  okText: { fontSize: 16, fontWeight: '600', color: 'white' },
  hints: { maxHeight: 120, backgroundColor: '#f8f9fa', marginHorizontal: 20, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  hint: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 8 },
  hintText: { fontSize: 14, color: '#333' }
})
