<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import { state, api, refreshSession, localDemo } from './main.js';

const router = useRouter();
const demoUsers = [
  { id: 'agent-1', name: 'Демо: Агент 1', role: 'Агент' },
  { id: 'agent-2', name: 'Демо: Агент 2', role: 'Агент' },
  { id: 'admin-1', name: 'Демо: Администратор', role: 'Администратор' }
];
const busy = ref(false);
const error = ref('');
const modalClose = ref(null);
const bannerOpen = computed(() => state.showBanner || (localDemo && state.previewBanner));
watch(bannerOpen, async shown => { if (shown) { await nextTick(); modalClose.value?.focus(); } });
async function login(id) {
  busy.value = true; error.value = '';
  try {
    const session = await api('/session', { method: 'POST', body: JSON.stringify({ userId: id }) });
    state.user = session.user;
    state.showBanner = session.showBanner;
    state.previewBanner = false;
    await router.push('/dashboard');
  } catch (e) { error.value = e.message; }
  busy.value = false;
}
async function logout() {
  state.previewBanner = false;
  await api('/session', { method: 'DELETE' });
  await refreshSession();
  await router.push('/dashboard');
}
async function dismissBanner(goToForm = false) {
  if (state.previewBanner) {
    state.previewBanner = false;
    if (goToForm) await router.push('/requests/new');
    return;
  }
  try {
    await api('/banner/dismiss', { method: 'POST' });
    state.showBanner = false;
    if (goToForm) await router.push('/requests/new');
  } catch (e) { error.value = e.message; }
}
</script>

<template>
  <div class="site-shell">
    <header class="topbar" :inert="bannerOpen">
      <div class="topbar-inner">
        <RouterLink class="brand" to="/dashboard" aria-label="Главная Agenta">agenta<span class="brand-dot">.</span></RouterLink>
        <template v-if="state.user">
          <nav class="topnav" aria-label="Основное меню">
            <RouterLink to="/dashboard">Главная</RouterLink>
            <RouterLink to="/requests">Реестр заявок</RouterLink>
          </nav>
          <RouterLink class="header-action" to="/requests/new">Направить на ремонт <span aria-hidden="true">↗</span></RouterLink>
          <div class="account">
            <span class="account-name">{{ state.user.name }}</span>
            <button type="button" class="text-button" @click="logout">Выйти</button>
          </div>
        </template>
      </div>
    </header>

    <main v-if="state.ready && state.user" class="page-wrap" :inert="bannerOpen">
      <div class="local-label">Локальный тестовый прототип · данные вымышленные</div>
      <RouterView />
    </main>
    <main v-else-if="state.ready" class="login-wrap">
      <div class="login-card">
        <div class="eyebrow">Локальная модель кабинета</div>
        <h1>Выберите демонстрационный вход</h1>
        <p>Это отдельный прототип. Рабочая учётная запись Agenta здесь не используется.</p>
        <div class="login-options">
          <button v-for="person in demoUsers" :key="person.id" type="button" :disabled="busy" @click="login(person.id)">
            <span>{{ person.name }}</span><small>{{ person.role }}</small>
          </button>
        </div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div>
    </main>

    <div v-if="state.user && bannerOpen" class="modal-backdrop">
      <section class="banner-modal" role="dialog" aria-modal="true" aria-label="Зарабатывайте на ремонте автомобилей">
        <img class="banner-image" src="/banner-approved.png" alt="Альтернатива: зарабатывайте на ремонте автомобилей. Направляйте клиентов в кузовные центры и получайте дополнительное вознаграждение." />
        <button ref="modalClose" class="banner-hitarea banner-hitarea-close" type="button" aria-label="Закрыть баннер" @click="dismissBanner(false)"></button>
        <button class="banner-hitarea banner-hitarea-action" type="button" aria-label="Направить на ремонт — открыть форму заявки" @click="dismissBanner(true)"></button>
      </section>
    </div>
  </div>
</template>
