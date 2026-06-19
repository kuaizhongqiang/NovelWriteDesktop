export function useFontSize() {
  const fontSize = ref(18)
  const fontSizeOptions = [14, 16, 18, 20, 22, 24] as const

  function increase() {
    if (fontSize.value < 24) fontSize.value += 2
  }

  function decrease() {
    if (fontSize.value > 14) fontSize.value -= 2
  }

  return { fontSize, fontSizeOptions, increase, decrease }
}
