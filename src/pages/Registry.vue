<script setup>
import { ref, computed, onMounted } from 'vue';
import { state, api } from '../main.js';
const rows = ref([]);
const error = ref('');
const search = ref('');
const status = ref('');
const repairType = ref('');
onMounted(async () => { try { rows.value = await api('/requests'); } catch (e) { error.value = e.message; } });
const filtered = computed(() => rows.value.filter(row => {
  const term = search.value.trim().toLocaleLowerCase('ru');
  return (!status.value || row.status === status.value) && (!repairType.value || row.repair_type === repairType.value) && (!term || [row.client_name,row.city,row.vehicle_make,row.vehicle_model,row.vehicle_plate,row.repair_type,row.id].some(v => String(v).toLocaleLowerCase('ru').includes(term)));
}));
const statuses = ['Новая','В работе','Ожидает клиента','Завершена','Отменена'];
const repairTypes = ['ОСАГО', 'КАСКО', 'Коммерческий ремонт', 'Не указан'];
function date(value) { return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value)); }
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">Заявки на ремонт</div><h1>Реестр заявок</h1><p>{{ state.user.role === 'admin' ? 'Все заявки агентов' : 'Только ваши заявки' }}</p></div><RouterLink v-if="state.user.role === 'agent'" class="primary-button" to="/requests/new">Новая заявка <span aria-hidden="true">↗</span></RouterLink></div>
  <section class="registry-card">
    <div class="filters"><label>Поиск<input v-model="search" type="search" placeholder="Клиент, город, автомобиль" /></label><label>Статус<select v-model="status"><option value="">Все статусы</option><option v-for="item in statuses" :key="item">{{ item }}</option></select></label><label>Вид ремонта<select v-model="repairType"><option value="">Все виды</option><option v-for="item in repairTypes" :key="item">{{ item }}</option></select></label><div class="result-count">Найдено: {{ filtered.length }}</div></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-else-if="!filtered.length" class="empty-state"><div class="section-number">00</div><h2>Заявок не найдено</h2><p>{{ rows.length ? 'Попробуйте изменить поиск или фильтр.' : 'Первая тестовая заявка появится здесь после создания.' }}</p></div>
    <div v-else class="table-scroll"><table><thead><tr><th>Заявка</th><th>Вид ремонта</th><th>Клиент</th><th>Автомобиль</th><th>Статус</th><th v-if="state.user.role === 'admin'">Агент</th><th></th></tr></thead><tbody><tr v-for="row in filtered" :key="row.id"><td><strong>№ {{ row.id.slice(0,8).toUpperCase() }}</strong><small>{{ date(row.created_at) }}</small></td><td><strong>{{ row.repair_type }}</strong><small v-if="row.bonus_percent">{{ row.bonus_percent }}%</small></td><td>{{ row.client_name }}<small>{{ row.city || 'Город не указан' }}</small></td><td>{{ row.vehicle_make }} {{ row.vehicle_model }}<small>{{ row.vehicle_plate }}</small></td><td><span class="status-pill">{{ row.status }}</span></td><td v-if="state.user.role === 'admin'">{{ row.owner_name }}</td><td><RouterLink :to="`/requests/${row.id}`">Открыть →</RouterLink></td></tr></tbody></table></div>
  </section>
</template>
