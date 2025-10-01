import React,{useState,useCallback} from 'react'
import {View,Text,FlatList,StyleSheet,SafeAreaView,StatusBar,TouchableOpacity,Alert,TextInput} from 'react-native'
import {Ionicons} from '@expo/vector-icons'
import {useStore,addToShoppingList,removeFromShoppingList,updateShoppingItem,markShoppingItemBought,moveBoughtToPantry,showSnackbar,setShoppingList} from '../services/store'
import {ListItem} from '../components/ListItem'
import {EmptyState} from '../components/EmptyState'

export default function ShoppingList(){
  const {state,dispatch} = useStore()
  const [editingId,setEditingId] = useState(null)
  const [editQty,setEditQty] = useState('')
  const [editUnit,setEditUnit] = useState('')

  const clickCheck = useCallback((itemId)=>{
    const item = state.shoppingList.find((item)=> item.id===itemId)
    if (item){
      dispatch(markShoppingItemBought(itemId,!item.bought))
    }
  },[state.shoppingList,dispatch])

  const clickRemove = useCallback((itemId)=>{
    dispatch(removeFromShoppingList(itemId))
  },[dispatch])

  const clickEdit = useCallback((item)=>{
    setEditingId(item.id)
    setEditQty(item.qty?.toString() || '')
    setEditUnit(item.unit || '')
  },[])

  const clickSave = useCallback((item)=>{
    dispatch(updateShoppingItem({
      ...item,
      qty: editQty,
      unit: editUnit,
    }))
    setEditingId(null)
    setEditQty('')
    setEditUnit('')
  },[editQty,editUnit,dispatch])

  const clickCancel = useCallback(()=>{
    setEditingId(null)
    setEditQty('')
    setEditUnit('')
  },[])

  const clickMoveToPantry = useCallback(()=>{
    const boughtItems = state.shoppingList.filter((item)=> item.bought)
    if (boughtItems.length===0){
      Alert.alert('No Items','Mark items as bought first to move them to your pantry.')
      return
    }
    Alert.alert(
      'Move to Pantry',
      `Move ${boughtItems.length} bought items to your pantry and remove them from shopping list?`,
      [
        {text:'Cancel',style:'cancel'},
        {
          text: 'Move',
          onPress: ()=>{
            dispatch(moveBoughtToPantry())
            Alert.alert('Success',`Moved ${boughtItems.length} items to your pantry!`)
          },
        },
      ]
    )
  },[state.shoppingList,dispatch])

  const clickClear = useCallback(()=>{
    Alert.alert(
      'Clear Shopping List',
      'Are you sure you want to remove all items from your shopping list?',
      [
        {text:'Cancel',style:'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: ()=> dispatch(setShoppingList([])),
        },
      ]
    )
  },[dispatch])

  const showItem = ({item})=>{
    const isEditing = editingId === item.id
    
    if (isEditing){
      return (
        <View style={styles.editItem}>
          <View style={styles.editTop}>
            <Text style={styles.editName}>{item.name}</Text>
          </View>
          
          <View style={styles.editInputs}>
            <View style={styles.editInputBox}>
              <Text style={styles.editLabel}>Qty</Text>
              <TextInput
                style={styles.editInput}
                value={editQty}
                onChangeText={setEditQty}
                placeholder="2"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.editInputBox}>
              <Text style={styles.editLabel}>Unit</Text>
              <TextInput
                style={styles.editInput}
                value={editUnit}
                onChangeText={setEditUnit}
                placeholder="cups"
              />
            </View>
          </View>
          
          <View style={styles.editBtns}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={clickCancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={() => clickSave(item)}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )
    }

    const quantityText = item.qty && item.unit ? `${item.qty} ${item.unit}` : item.qty || ''
    const subtitle = [quantityText,item.source].filter(Boolean).join(' • ')

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
              <Ionicons name="create-outline" size={20} color="#666"/>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => clickRemove(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30"/>
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

  const showTop = ()=>{
    const totalItems = state.shoppingList.length
    const boughtItems = state.shoppingList.filter((item)=> item.bought).length
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
      <StatusBar barStyle="dark-content" backgroundColor="white"/>
      {state.shoppingList.length > 0 ? (
        <FlatList
          data={state.shoppingList}
          renderItem={showItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={showTop}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}/>
      ) : (
        <View style={styles.main}>
          {showTop()}
          <EmptyState
            icon="list-outline"
            title="Your shopping list is empty"
            description="Add missing ingredients from recipes to build your shopping list"/>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  editItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  editTop: {
    marginBottom: 12,
  },
  editName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  editInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  editInputBox: {
    flex: 1,
  },
  editLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#f8f9fa',
  },
  editBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
})
