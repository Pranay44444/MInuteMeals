import React from 'react'
import {View,Text,StyleSheet} from 'react-native'

export const Badge = ({text,variant = 'default',size = 'medium', style}) => {
  const getColor = () => {
    if (variant === 'success'){
      return styles.green}
    if (variant === 'warning'){
      return styles.yellow}
    if (variant === 'error'){
      return styles.red}
    if (variant === 'info'){
      return styles.blue}
    if (variant === 'cookNow'){
      return styles.cookNow}
    if (variant === 'missing'){
      return styles.missing}
    return styles.gray
  }

  const getTextColor = () => {
    if (variant === 'success'){
      return styles.greenText}
    if (variant === 'warning'){
      return styles.yellowText}
    if (variant === 'error'){
      return styles.redText}
    if (variant === 'info'){
      return styles.blueText}
    if (variant === 'cookNow'){
      return styles.cookNowText}
    if (variant === 'missing'){
      return styles.missingText}
    return styles.grayText
  }

  const getSize = () => {
    if (size === 'small'){
      return styles.small}
    if (size === 'large'){
      return styles.large}
    return styles.medium
  }

  const getTextSize = () => {
    if (size === 'small'){
      return styles.smallText}
    if (size === 'large'){
      return styles.largeText}
    return styles.mediumText
  }

  return (
    <View style={[styles.main,getColor(),getSize(),style]}>
      <Text style={[styles.text,getTextColor(),getTextSize()]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  text: {
    fontWeight: '600',
    textAlign: 'center'
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  medium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  smallText: {
    fontSize: 10
  },
  mediumText: {
    fontSize: 12
  },
  largeText: {
    fontSize: 14
  },
  gray: {
    backgroundColor: '#f0f0f0'
  },
  grayText: {
    color: '#666'
  },
  green: {
    backgroundColor: '#d4edda'
  },
  greenText: {
    color: '#155724'
  },
  yellow: {
    backgroundColor: '#fff3cd'
  },
  yellowText: {
    color: '#856404'
  },
  red: {
    backgroundColor: '#f8d7da'
  },
  redText: {
    color: '#721c24'
  },
  blue: {
    backgroundColor: '#cce7ff'
  },
  blueText: {
    color: '#004085'
  },
  cookNow: {
    backgroundColor: '#28a745'
  },
  cookNowText: {
    color: 'white'
  },
  missing: {
    backgroundColor: '#ffc107'
  },
  missingText: {
    color: '#212529'
  }
})
