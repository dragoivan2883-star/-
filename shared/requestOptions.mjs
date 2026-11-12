export const cities = ['Казань', 'Нижнекамск', 'Набережные Челны'];

export const insurersByType = {
  osago: ['Альфа', 'Ингосстрах', 'Ренессанс', 'МАКС', 'Пари'],
  kasko: ['Зетта', 'Альфа', 'Ингосстрах', 'Пари', 'МАКС', 'Совком', 'Ренессанс']
};

export function availableInsurers(repairType, city) {
  const insurers = insurersByType[repairType] || [];
  return repairType === 'kasko' && city !== 'Казань'
    ? insurers.filter(insurer => insurer !== 'Ренессанс')
    : insurers;
}
