import React from 'react'
import {Image,View,StyleSheet} from 'react-native'
import {Ionicons} from '@expo/vector-icons'


export const PantryIcon = ({color,size,style}) => {
  const useBasket = true
  if (useBasket){
    return (
      <View style={[styles.main,{width: size,height: size},style]}>
        <Image source={require('../../assets/icons/basket.png')} style={[styles.img,{width: size,height: size,tintColor: color}]} resizeMode="contain"/>
      </View>
    )
  }
  return <Ionicons name="archive-outline" size={size} color={color} style={style}/>
}

const styles = StyleSheet.create({
  main: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  img: {}
})
