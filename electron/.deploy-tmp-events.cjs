// temp: dump FBro public event catalog via the generated coverage JSON directly
const cov = require('T:/electron/lingbuilder/electron/src/services/modules/fbroApiCoverage.generated.json');
const events = cov.eventCatalog || [];
console.log('total events:', events.length);
for (const e of events) {
  if (e.exposure !== 'public') continue;
  const fields = (e.fields || []).map(f => f.name).join(',');
  console.log([e.lingBuilderName, e.eventId, e.kind, e.decisionMode, fields].join(' | '));
}
