export const debounce = (action,wait) => {
  let timer
  return (...inputs) => {
    clearTimeout(timer)
    timer = setTimeout(() => action(...inputs),wait)
  }
}
