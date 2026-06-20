/**
 * useFontSize — 阅读页字体大小控制
 *
 * 提供增大/减小字体大小的操作，可选值固定为 [14, 16, 18, 20, 22, 24]。
 *
 * @returns {Object}
 * @returns {Ref<number>} fontSize - 当前字号（默认 18）
 * @returns {readonly number[]} fontSizeOptions - 可选字号列表
 * @returns {Function} increase - 增大字号（上限 24）
 * @returns {Function} decrease - 减小字号（下限 14）
 *
 * @example
 * ```vue
 * <script setup>
 * const { fontSize, increase, decrease } = useFontSize()
 * </script>
 * <template>
 *   <div :style="{ fontSize: fontSize + 'px' }">正文内容</div>
 *   <button @click="decrease">A-</button>
 *   <button @click="increase">A+</button>
 * </template>
 * ```
 */
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
