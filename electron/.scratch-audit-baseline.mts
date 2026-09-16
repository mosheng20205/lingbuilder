import { BUILTIN_MODULES } from './src/services/modules/builtinModules';
import { auditControlReferenceManifests } from './src/services/modules/controlReferenceAuditService';
const audit = auditControlReferenceManifests(BUILTIN_MODULES);
console.log(JSON.stringify({
  modules: audit.moduleCount,
  commands: audit.commandCount,
  parameters: audit.parameterCount,
  controlReferences: audit.controlReferenceCount,
  commandDigest: audit.commandDigest,
  parameterDigest: audit.parameterDigest,
  violations: audit.violations.slice(0, 5)
}, null, 2));
