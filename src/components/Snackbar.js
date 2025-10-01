import React,{useEffect,useState} from 'react'
import {View,Text,StyleSheet,TouchableOpacity} from 'react-native'
import {Ionicons} from '@expo/vector-icons'

export const Snackbar = ({visible,message,actionText,onActionPress,onDismiss,duration = 4000})=>{
  const [isUp,setIsUp] = useState(false)
  const [isVisible,setIsVisible] = useState(false)

  useEffect(()=>{
    const shouldShow = visible
    if (shouldShow){
      showBar()
      const timer = setTimeout(()=>{
        hideBar()
      },duration)
      return ()=> clearTimeout(timer)
    } else {
      hideBar()
    }
  },[visible,duration])

  const showBar = ()=>{
    setIsVisible(true)
    setTimeout(()=>{
      setIsUp(true)
    },50)
  }
  const hideBar = ()=>{
    setIsUp(false)
    setTimeout(()=>{
      setIsVisible(false)
      const hasDismiss = onDismiss
      if (hasDismiss) onDismiss()
    },300)
  }
  if (!isVisible){
    return null
  }
  const hasAction = actionText && onActionPress

  return (
    <View 
      style={[styles.main,isUp ? styles.up : styles.down]}>
      <View style={styles.box}>
        <Text style={styles.text}>{message}</Text>
        <View style={styles.buttons}>
          {hasAction && (
            <TouchableOpacity onPress={onActionPress} style={styles.action}>
              <Text style={styles.actionText}>{actionText}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={hideBar} style={styles.close}>
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 1000
  },
  up: {
    transform: [{translateY: 0}],
    opacity: 1
  },
  down: {
    transform: [{translateY: 100}],
    opacity: 0
  },
  box: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  text: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    marginRight: 12
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  actionText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600'
  },
  close: {
    padding: 4
  }
})
