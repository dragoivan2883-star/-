<script setup>
import { state, localDemo } from '../main.js';
</script>
<template>
  <section class="hero-panel">
    <div class="eyebrow">Главная</div>
    <h1>Добрый день, {{ state.user.name.replace('Демо: ', '') }}!</h1>
    <p>Направление на ремонт и заявки собраны в отдельном разделе.</p>
    <button v-if="localDemo" class="preview-button" type="button" @click="state.previewBanner = true">Тестировать баннер</button>
  </section>
  <section class="dashboard-grid" aria-label="Рабочие разделы">
    <RouterLink class="section-card" to="/requests">
      <div class="section-number">01</div><h2>Реестр заявок</h2>
      <p>Поиск, статусы и карточки обращений по ремонту.</p><span class="card-link">Открыть реестр →</span>
    </RouterLink>
    <div class="section-card muted-card">
      <div class="section-number">02</div><h2>Журнал полисов</h2>
      <p>Этот раздел показан как часть оболочки. Работа с полисами в локальной модели не предусмотрена.</p>
    </div>
  </section>
</template>
