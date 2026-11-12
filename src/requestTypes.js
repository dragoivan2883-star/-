export const requestTypes = [
  { id: 'osago', label: 'ОСАГО', percent: 1 },
  { id: 'kasko', label: 'КАСКО', percent: 2 },
  { id: 'commercial', label: 'Коммерческий ремонт', percent: 3 }
];

export function getRequestType(id) {
  return requestTypes.find(type => type.id === id);
}
