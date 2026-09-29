const TEMPLATES = {
  clinic: {
    key: 'clinic',
    label: 'Clinica / consultorio',
    services: [
      { name: 'Consulta', durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 10, requiredResourceType: 'professional' },
      { name: 'Retorno', durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 10, requiredResourceType: 'professional' }
    ],
    resources: [
      { name: 'Profissional 1', resourceType: 'professional', timezone: 'America/Sao_Paulo' }
    ]
  },
  salon: {
    key: 'salon',
    label: 'Salao / barbearia',
    services: [
      { name: 'Corte', durationMinutes: 45, bufferBeforeMinutes: 0, bufferAfterMinutes: 5, requiredResourceType: 'professional' },
      { name: 'Barba', durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 5, requiredResourceType: 'professional' },
      { name: 'Corte + barba', durationMinutes: 75, bufferBeforeMinutes: 0, bufferAfterMinutes: 5, requiredResourceType: 'professional' }
    ],
    resources: [
      { name: 'Profissional 1', resourceType: 'professional', timezone: 'America/Sao_Paulo' }
    ]
  },
  therapy: {
    key: 'therapy',
    label: 'Terapia / sessoes',
    services: [
      { name: 'Sessao', durationMinutes: 50, bufferBeforeMinutes: 0, bufferAfterMinutes: 10, requiredResourceType: 'professional' }
    ],
    resources: [
      { name: 'Terapeuta 1', resourceType: 'professional', timezone: 'America/Sao_Paulo' }
    ]
  },
  workshop: {
    key: 'workshop',
    label: 'Oficina / assistencia',
    services: [
      { name: 'Diagnostico', durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 15, requiredResourceType: 'bay' },
      { name: 'Servico rapido', durationMinutes: 90, bufferBeforeMinutes: 0, bufferAfterMinutes: 15, requiredResourceType: 'bay' }
    ],
    resources: [
      { name: 'Box 1', resourceType: 'bay', timezone: 'America/Sao_Paulo' }
    ]
  }
};

function defaultWorkingHours() {
  return {
    mon: [{ from: '09:00', to: '18:00' }],
    tue: [{ from: '09:00', to: '18:00' }],
    wed: [{ from: '09:00', to: '18:00' }],
    thu: [{ from: '09:00', to: '18:00' }],
    fri: [{ from: '09:00', to: '18:00' }],
    sat: [{ from: '09:00', to: '13:00' }]
  };
}

function listTemplates() {
  return Object.values(TEMPLATES).map(item => ({
    key: item.key,
    label: item.label,
    services: item.services.map(service => service.name),
    resourceTypes: [...new Set(item.resources.map(resource => resource.resourceType))]
  }));
}

function getTemplate(key) {
  return TEMPLATES[String(key || '').trim().toLowerCase()] || null;
}

module.exports = { listTemplates, getTemplate, defaultWorkingHours };
