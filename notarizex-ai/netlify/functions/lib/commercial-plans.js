const PLANS = Object.freeze({
  fundador: Object.freeze({
    code: 'fundador',
    name: 'SmartBots Completo — Fundador',
    amountCents: 9900,
    billingCycle: 'monthly',
    public: true,
    launch: true
  }),
  completo: Object.freeze({
    code: 'completo',
    name: 'SmartBots Completo',
    amountCents: 14900,
    billingCycle: 'monthly',
    public: true,
    launch: false
  })
});

const FOUNDER_LIMIT = 10;

function money(cents) {
  return Number(cents || 0) / 100;
}

function legacyAlias(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['fundador', 'founder', 'launch', 'lancamento', 'lançamento'].includes(v)) return PLANS.fundador;
  if (['completo', 'profissional', 'premium', 'essencial', 'bot para site', 'bot whatsapp'].includes(v)) return PLANS.completo;
  return PLANS.completo;
}

module.exports = { PLANS, FOUNDER_LIMIT, money, legacyAlias };
