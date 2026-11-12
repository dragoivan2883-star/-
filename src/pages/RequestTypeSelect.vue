<script setup>
import { state } from '../main.js';
import { requestTypes } from '../requestTypes.js';
</script>

<template>
  <div class="page-heading">
    <div><div class="eyebrow">Новая заявка</div><h1>Выберите вид ремонта</h1><p>Выберите направление, чтобы открыть форму заявки.</p></div>
    <RouterLink class="back-link" to="/dashboard">← На главную</RouterLink>
  </div>
  <div v-if="state.user.role === 'admin'" class="notice">Заявку создаёт агент. Выберите демонстрационный вход агента.</div>
  <section v-else class="request-type-grid" aria-label="Виды ремонта">
    <RouterLink v-for="type in requestTypes" :key="type.id" class="request-type-card" :to="`/requests/new/${type.id}`">
      <span class="request-type-name">{{ type.label }}</span>
      <strong class="request-type-percent">{{ type.percent }}%</strong>
      <span class="request-type-action">Оставить заявку <span aria-hidden="true">→</span></span>
    </RouterLink>
  </section>
</template>
