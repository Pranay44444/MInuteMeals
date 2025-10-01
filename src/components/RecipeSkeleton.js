import React from 'react'
import {View,StyleSheet} from 'react-native'

export const RecipeSkeleton = ()=>{
  const [isBright,setIsBright] = React.useState(true)

  React.useEffect(()=>{
    const timer = setInterval(()=>{
      setIsBright(prev=> !prev)
    },1000)
    return ()=>clearInterval(timer)
  },[])

  const GlowBox = ({style})=>(
    <View style={[styles.glow,isBright ? styles.bright : styles.dim,style]}/>
  )

  return (
    <View style={styles.main}>
      <View style={styles.img}>
        <GlowBox style={styles.imgBox}/>
      </View>
      <View style={styles.box}>
        <GlowBox style={styles.title}/>
        <GlowBox style={styles.sub}/>
        <View style={styles.row}>
          <GlowBox style={styles.item}/>
          <GlowBox style={styles.item}/>
          <GlowBox style={styles.item}/>
        </View>
        <View style={styles.badges}>
          <GlowBox style={styles.badge}/>
          <GlowBox style={styles.badge}/>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0,height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden'
  },
  img: {
    height: 150
  },
  imgBox: {
    width: '100%',
    height: '100%'
  },
  box: {
    padding: 12
  },
  glow: {
    backgroundColor: '#e0e0e0',
    borderRadius: 4
  },
  bright: {
    opacity: 0.7
  },
  dim: {
    opacity: 0.3
  },
  title: {
    height: 20,
    width: '80%',
    marginBottom: 8
  },
  sub: {
    height: 16,
    width: '60%',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  item: {
    height: 14,
    width: 60
  },
  badges: {
    flexDirection: 'row',
    gap: 8
  },
  badge: {
    height: 24,
    width: 80,
    borderRadius: 12
  }
})
