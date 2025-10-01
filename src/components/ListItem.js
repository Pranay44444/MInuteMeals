import React from 'react'
import {View,Text,TouchableOpacity,StyleSheet} from 'react-native'
import {Ionicons} from '@expo/vector-icons'

export const ListItem = ({title,subtitle,leftIcon,rightIcon,onPress,onRightIconPress,checked = false,onToggleCheck,showCheckbox = false,style,titleStyle,subtitleStyle})=>{
  const clickCheckbox = (e)=>{
    e.stopPropagation()
    if (onToggleCheck){
      onToggleCheck()
    }
  }
  const clickRightIcon = (e)=>{
    e.stopPropagation()
    if (onRightIconPress){
      onRightIconPress()
    }
  }
  const hasCheckbox = showCheckbox
  const hasLeftIcon = leftIcon
  const hasSubtitle = subtitle
  const hasRightIcon = rightIcon

  return (
    <TouchableOpacity style={[styles.main,style]} onPress={onPress} disabled={!onPress}>
      <View style={styles.left}>
        {hasCheckbox && (
          <TouchableOpacity style={styles.check} onPress={clickCheckbox}>
            <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? "#007AFF" : "#ccc"}/>
          </TouchableOpacity>
        )}
        {hasLeftIcon && (
          <View style={styles.icon}>{leftIcon}</View>
        )}
        <View style={styles.text}>
          <Text style={[styles.title,titleStyle]} numberOfLines={2}>{title}</Text>
          {hasSubtitle && (
            <Text style={[styles.sub,subtitleStyle]} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
      </View>
      {hasRightIcon && (
        <TouchableOpacity style={styles.right} onPress={onRightIconPress || onPress}>
          {rightIcon}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  check: {
    marginRight: 12
  },
  icon: {
    marginRight: 12
  },
  text: {
    flex: 1
  },
  title: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500'
  },
  sub: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
  },
  right: {
    padding: 4,
    marginLeft: 8
  }
})
