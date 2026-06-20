import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)

// 全局错误处理：记录到控制台，UI 通知由 App.vue 中的 handler 负责
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Global Error]', err)
  console.error('[Error Info]', info)
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  event.preventDefault()
})

app.use(createPinia())
app.use(router)
app.mount('#app')
