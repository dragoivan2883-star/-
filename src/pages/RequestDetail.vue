<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../main.js';
const route = useRoute();
const row = ref(null);
const error = ref('');
watch(() => route.params.id, async id => { row.value = null; error.value = ''; try { row.value = await api(`/requests/${id}`); } catch(e) { error.value = e.message; } }, { immediate: true });
function date(value) { return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)); }
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">Заявка на ремонт</div><h1>{{ row ? `№ ${row.id.slice(0,8).toUpperCase()}` : 'Карточка заявки' }}</h1><p v-if="row">Создана {{ date(row.created_at) }}</p></div><RouterLink class="back-link" to="/requests">← К реестру</RouterLink></div>
  <div v-if="error" class="notice error" role="alert">{{ error }}</div>
  <div v-else-if="row" class="detail-grid">
    <section class="detail-card"><div class="detail-top"><h2>Данные заявки</h2><span class="status-pill">{{ row.status }}</span></div><dl><dt>Клиент</dt><dd>{{ row.client_name }}</dd><dt>Телефон</dt><dd>{{ row.client_phone }}</dd><dt>Автомобиль</dt><dd>{{ row.vehicle_make }} {{ row.vehicle_model }}{{ row.vehicle_year ? `, ${row.vehicle_year}` : '' }}</dd><dt>Госномер</dt><dd>{{ row.vehicle_plate }}</dd><dt>Агент</dt><dd>{{ row.owner_name }}</dd></dl></section>
    <section class="detail-card"><h2>Повреждения</h2><p class="damage-text">{{ row.damage_description }}</p></section>
  </div>
</template>
