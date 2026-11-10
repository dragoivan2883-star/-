import { createApp, reactive } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Dashboard from './pages/Dashboard.vue';
import RequestForm from './pages/RequestForm.vue';
import Registry from './pages/Registry.vue';
import RequestDetail from './pages/RequestDetail.vue';
import './style.css';

export const localDemo = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const state = reactive({ user: null, showBanner: false, previewBanner: false, ready: false });
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Не удалось выполнить запрос');
  return body;
}
export async function refreshSession() {
  const session = await api('/session');
  state.user = session.user;
  state.showBanner = session.showBanner;
  state.ready = true;
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: Dashboard },
    { path: '/requests', component: Registry },
    { path: '/requests/new', component: RequestForm },
    { path: '/requests/:id', component: RequestDetail }
  ]
});
createApp(App).use(router).mount('#app');
refreshSession().catch(() => { state.ready = true; });
