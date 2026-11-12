<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api, state } from '../main.js';
const route = useRoute();
const row = ref(null);
const error = ref('');
const selectedStatus = ref('');
const statusError = ref('');
const statusMessage = ref('');
const savingStatus = ref(false);
const statuses = ['Новая', 'В работе', 'Ожидает клиента', 'Завершена', 'Отменена'];
watch(() => route.params.id, async id => {
  row.value = null; error.value = ''; statusError.value = ''; statusMessage.value = '';
  try { row.value = await api(`/requests/${id}`); selectedStatus.value = row.value.status; }
  catch(e) { error.value = e.message; }
}, { immediate: true });
async function saveStatus() {
  if (!row.value || savingStatus.value || selectedStatus.value === row.value.status) return;
  savingStatus.value = true; statusError.value = ''; statusMessage.value = '';
  try {
    const result = await api(`/requests/${row.value.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: selectedStatus.value }) });
    row.value.status = result.status;
    statusMessage.value = 'Статус заявки сохранён';
  } catch (e) { statusError.value = e.message; }
  finally { savingStatus.value = false; }
}
function date(value) { return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)); }
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">Заявка на ремонт</div><h1>{{ row ? `№ ${row.id.slice(0,8).toUpperCase()}` : 'Карточка заявки' }}</h1><p v-if="row">Создана {{ date(row.created_at) }}</p></div><RouterLink class="back-link" to="/requests">← К реестру</RouterLink></div>
  <div v-if="error" class="notice error" role="alert">{{ error }}</div>
  <div v-else-if="row" class="detail-grid">
    <section class="detail-card"><div class="detail-top"><h2>Данные заявки</h2><span class="status-pill">{{ row.status }}</span></div><dl><dt>Вид ремонта</dt><dd>{{ row.repair_type }}{{ row.bonus_percent ? ` · ${row.bonus_percent}%` : '' }}</dd><dt>Клиент</dt><dd>{{ row.client_name }}</dd><dt>Телефон</dt><dd>{{ row.client_phone }}</dd><dt>Город</dt><dd>{{ row.city || 'Не указан' }}</dd><dt>Автомобиль</dt><dd>{{ row.vehicle_make }} {{ row.vehicle_model }}{{ row.vehicle_year ? `, ${row.vehicle_year}` : '' }}</dd><dt>Госномер</dt><dd>{{ row.vehicle_plate }}</dd><dt>Агент</dt><dd>{{ row.owner_name }}</dd></dl>
      <form v-if="state.user?.role === 'admin'" class="status-editor" @submit.prevent="saveStatus">
        <label for="request-status">Изменить статус заявки</label>
        <div class="status-controls"><select id="request-status" v-model="selectedStatus" @change="statusMessage = ''"><option v-for="item in statuses" :key="item" :value="item">{{ item }}</option></select><button class="primary-button" type="submit" :disabled="savingStatus || selectedStatus === row.status">{{ savingStatus ? 'Сохранение…' : 'Сохранить статус' }}</button></div>
        <p v-if="statusError" class="error" role="alert">{{ statusError }}</p><p v-if="statusMessage" class="status-success" role="status">{{ statusMessage }}</p>
      </form>
    </section>
    <section class="detail-card"><h2>Повреждения</h2><p class="damage-text">{{ row.damage_description }}</p></section>
  </div>
</template>
