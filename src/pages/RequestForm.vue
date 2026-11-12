<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { state, api, refreshSession } from '../main.js';
import { getRequestType } from '../requestTypes.js';
import { cities, availableInsurers } from '../../shared/requestOptions.mjs';

const router = useRouter();
const route = useRoute();
const requestType = computed(() => getRequestType(route.params.type));
const form = reactive({ clientName: '', clientPhone: '', city: '', insurer: '', vehicleMake: '', vehicleModel: '', vehiclePlate: '', vehicleYear: '', damageDescription: '' });
const insurers = computed(() => availableInsurers(requestType.value?.id, form.city));
watch([() => form.city, () => route.params.type], () => {
  if (!insurers.value.includes(form.insurer)) form.insurer = '';
});
const busy = ref(false);
const error = ref('');
async function submit() {
  if (!requestType.value) return;
  error.value = '';
  busy.value = true;
  try {
    const result = await api('/requests', { method: 'POST', body: JSON.stringify({ ...form, repairType: requestType.value.id }) });
    await refreshSession();
    await router.push(`/requests/${result.id}`);
  } catch (e) { error.value = e.message; }
  busy.value = false;
}
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">Новая заявка</div><h1>{{ requestType ? `Заявка: ${requestType.label}` : 'Вид ремонта не найден' }}</h1><p v-if="requestType">{{ requestType.percent }}% · Все видимые поля, кроме года выпуска, обязательны.</p></div><RouterLink class="back-link" to="/requests/new">← К выбору вида ремонта</RouterLink></div>
  <div v-if="state.user.role === 'admin'" class="notice">Заявку создаёт агент. Выберите демонстрационный вход агента.</div>
  <div v-else-if="!requestType" class="notice">Выберите ОСАГО, КАСКО или коммерческий ремонт.</div>
  <form v-else class="form-shell" @submit.prevent="submit">
    <fieldset><legend><span>01</span> Клиент</legend><div class="form-grid"><label>Имя клиента<input v-model="form.clientName" required maxlength="120" autocomplete="off" placeholder="Например, Иван Петров" /></label><label>Телефон<input v-model="form.clientPhone" required maxlength="30" inputmode="tel" autocomplete="off" placeholder="+7 900 000-00-00" /></label><label>Город<select v-model="form.city" required autocomplete="address-level2"><option value="" disabled>Выберите город</option><option v-for="city in cities" :key="city" :value="city">{{ city }}</option></select></label><label v-if="insurers.length">Страховая компания<select v-model="form.insurer" required :disabled="!form.city"><option value="" disabled>{{ form.city ? 'Выберите компанию' : 'Сначала выберите город' }}</option><option v-for="insurer in insurers" :key="insurer" :value="insurer">{{ insurer }}</option></select><small v-if="requestType.id === 'kasko'">Ренессанс по КАСКО доступен только в Казани.</small></label></div></fieldset>
    <fieldset><legend><span>02</span> Автомобиль</legend><div class="form-grid"><label>Марка<input v-model="form.vehicleMake" required maxlength="80" placeholder="Например, Lada" /></label><label>Модель<input v-model="form.vehicleModel" required maxlength="80" placeholder="Например, Vesta" /></label><label>Госномер<input v-model="form.vehiclePlate" required maxlength="20" placeholder="А000АА 16" /></label><label>Год выпуска <em>необязательно</em><input v-model="form.vehicleYear" type="number" min="1950" max="2100" placeholder="2022" /></label></div></fieldset>
    <fieldset><legend><span>03</span> Повреждения</legend><label>Описание повреждений<textarea v-model="form.damageDescription" required maxlength="2000" rows="5" placeholder="Укажите повреждённые части автомобиля и обстоятельства"></textarea></label></fieldset>
    <div class="form-footer"><p>Данные сохраняются только в локальной базе прототипа.</p><button class="primary-button" type="submit" :disabled="busy">{{ busy ? 'Сохраняем…' : 'Создать тестовую заявку' }}</button></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>
</template>
