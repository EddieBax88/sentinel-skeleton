// Trail
export type { TrailLevel, TrailStep, TrailLeg, CodeTrail } from "./trail/types.js";
export { ALLOWED_LEVELS } from "./trail/types.js";
export type {
  ValidationFailure,
  ValidationResult,
  ValidatableDrill,
} from "./trail/validate.js";
export { validateCodeTrail, extractFirstNumber } from "./trail/validate.js";
export { NO_PARTS } from "./trail/grade.js";
export type {
  TrailVerdict,
  StepResult,
  GradeResult,
  DrillDef,
  UserPick,
} from "./trail/grade.js";
export { gradeTrail } from "./trail/grade.js";

// Plugin
export type {
  CalcInput,
  CalcOutput,
  Invariant,
  CalcPluginDef,
  CalcPlugin,
  InvariantReport,
} from "./plugin/types.js";
export { defineCalcPlugin } from "./plugin/defineCalcPlugin.js";
// NOTE: runInvariants is NOT exported here — it lives in the test-utils entry point only

// Drill
export type { CodeTrailDef } from "./drill/types.js";
export { defineCodeTrail } from "./drill/defineCodeTrail.js";

// Table
export type { TableValue } from "./table/types.js";
export { makeTableValue } from "./table/makeTableValue.js";

// Registry
export type { RegistryEntry, PluginRegistry } from "./registry/types.js";
export { createRegistry } from "./registry/createRegistry.js";
