<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { state, api, refreshSession } from '../main.js';

const router = useRouter();
const form = reactive({ clientName: '', clientPhone: '', vehicleMake: '', vehicleModel: '', vehiclePlate: '', vehicleYear: '', damageDescription: '' });
const busy = ref(false);
const error = ref('');
async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const result = await api('/requests', { method: 'POST', body: JSON.stringify(form) });
    await refreshSession();
    await router.push(`/requests/${result.id}`);
  } catch (e) { error.value = e.message; }
  busy.value = false;
}
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">Новая заявка</div><h1>Направить на ремонт</h1><p>Все поля, кроме года выпуска, обязательны.</p></div><RouterLink class="back-link" to="/requests">← К реестру</RouterLink></div>
  <div v-if="state.user.role === 'admin'" class="notice">Заявку создаёт агент. Выберите демонстрационный вход агента.</div>
  <form v-else class="form-shell" @submit.prevent="submit">
    <fieldset><legend><span>01</span> Клиент</legend><div class="form-grid"><label>Имя клиента<input v-model="form.clientName" required maxlength="120" autocomplete="off" placeholder="Например, Иван Петров" /></label><label>Телефон<input v-model="form.clientPhone" required maxlength="30" inputmode="tel" autocomplete="off" placeholder="+7 900 000-00-00" /></label></div></fieldset>
    <fieldset><legend><span>02</span> Автомобиль</legend><div class="form-grid"><label>Марка<input v-model="form.vehicleMake" required maxlength="80" placeholder="Например, Lada" /></label><label>Модель<input v-model="form.vehicleModel" required maxlength="80" placeholder="Например, Vesta" /></label><label>Госномер<input v-model="form.vehiclePlate" required maxlength="20" placeholder="А000АА 16" /></label><label>Год выпуска <em>необязательно</em><input v-model="form.vehicleYear" type="number" min="1950" max="2100" placeholder="2022" /></label></div></fieldset>
    <fieldset><legend><span>03</span> Повреждения</legend><label>Описание повреждений<textarea v-model="form.damageDescription" required maxlength="2000" rows="5" placeholder="Укажите повреждённые части автомобиля и обстоятельства"></textarea></label></fieldset>
    <div class="form-footer"><p>Данные сохраняются только в локальной базе прототипа.</p><button class="primary-button" type="submit" :disabled="busy">{{ busy ? 'Сохраняем…' : 'Создать тестовую заявку' }}</button></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>
</template>
