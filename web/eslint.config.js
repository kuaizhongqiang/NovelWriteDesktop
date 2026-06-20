// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

// unplugin-auto-import 注入的全局变量
const autoImportGlobals = {
  // Vue
  EffectScope: false,
  computed: false,
  createApp: false,
  customRef: false,
  defineAsyncComponent: false,
  defineComponent: false,
  effectScope: false,
  getCurrentInstance: false,
  getCurrentScope: false,
  getCurrentWatcher: false,
  h: false,
  inject: false,
  isProxy: false,
  isReactive: false,
  isReadonly: false,
  isRef: false,
  isShallow: false,
  markRaw: false,
  nextTick: false,
  onActivated: false,
  onBeforeMount: false,
  onBeforeUnmount: false,
  onBeforeUpdate: false,
  onDeactivated: false,
  onErrorCaptured: false,
  onMounted: false,
  onRenderTracked: false,
  onRenderTriggered: false,
  onScopeDispose: false,
  onServerPrefetch: false,
  onUnmounted: false,
  onUpdated: false,
  onWatcherCleanup: false,
  provide: false,
  reactive: false,
  readonly: false,
  ref: false,
  resolveComponent: false,
  shallowReactive: false,
  shallowReadonly: false,
  shallowRef: false,
  toRaw: false,
  toRef: false,
  toRefs: false,
  toValue: false,
  triggerRef: false,
  unref: false,
  useAttrs: false,
  useCssModule: false,
  useCssVars: false,
  useId: false,
  useModel: false,
  useSlots: false,
  useTemplateRef: false,
  watch: false,
  watchEffect: false,
  watchPostEffect: false,
  watchSyncEffect: false,
  // Pinia
  acceptHMRUpdate: false,
  createPinia: false,
  defineStore: false,
  getActivePinia: false,
  mapActions: false,
  mapGetters: false,
  mapState: false,
  mapStores: false,
  mapWritableState: false,
  setActivePinia: false,
  setMapStoreSuffix: false,
  storeToRefs: false,
  // Naive UI
  useDialog: false,
  useLoadingBar: false,
  useMessage: false,
  useNotification: false,
}

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '*.d.ts', 'src/auto-imports.d.ts', 'src/components.d.ts'] },

  // 全局推荐规则
  eslint.configs.recommended,
  {
    languageOptions: {
      globals: autoImportGlobals,
    },
  },

  // TypeScript 推荐规则
  ...tseslint.configs.recommended,

  // Vue 推荐规则
  ...pluginVue.configs['flat/recommended'],

  // Vue + TypeScript
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // 自定义规则覆盖
  {
    rules: {
      // 允许 any（渐进式采用）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 未使用变量（由 vue-tsc 处理得更精细）
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Vue 组件命名允许多词
      'vue/multi-word-component-names': 'off',
      // 模板中的 max attributes 放宽
      'vue/max-attributes-per-line': 'off',
      // 允许单行模板
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
)
