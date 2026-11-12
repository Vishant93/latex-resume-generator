import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'

createApp(App).mount('#app')

// Add dark mode toggle
const toggleDark = () => {
  document.documentElement.classList.toggle('dark')
}

// Add custom scrollbar styling
const initScrollbars = () => {
  document.querySelectorAll('.scrollbar').forEach(el => {
    el.style.setProperty('--scrollbar-width', '8px')
    el.style.setProperty('--scrollbar-color', '#9ca3af')
  })
}

initScrollbars()
window.toggleDark = toggleDark
