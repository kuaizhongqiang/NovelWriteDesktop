/**
 * useKeyboard — 阅读页键盘快捷键
 *
 * 绑定 ArrowLeft / ArrowRight 键到章节切换操作。
 * 组件挂载时注册事件，卸载时自动清理。
 *
 * @param {Object} handlers - 事件处理函数
 * @param {Function} handlers.prevChapter - 按 ← 时触发：切换到上一章
 * @param {Function} handlers.nextChapter - 按 → 时触发：切换到下一章
 *
 * @example
 * ```vue
 * <script setup>
 * useKeyboard({
 *   prevChapter: goPrevChapter,
 *   nextChapter: goNextChapter,
 * })
 * </script>
 * ```
 */
export function useKeyboard(handlers: {
  prevChapter: () => void
  nextChapter: () => void
}) {
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      handlers.prevChapter()
    } else if (e.key === 'ArrowRight') {
      handlers.nextChapter()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
