import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const applicationSource = readFileSync(new URL('../../www/index.html', import.meta.url), 'utf8');

// Explicit neighboring anchors avoid a brace parser (regexes/template strings in
// the legacy source contain braces). Never execute the full application/SDKs.
export function extractFunction(source, name, endAnchor) {
  const startAnchor = `function ${name}(`;
  const start = source.indexOf(startAnchor);
  if (start < 0 || source.indexOf(startAnchor, start + startAnchor.length) !== -1) {
    throw new Error(`Characterization source: expected exactly one ${startAnchor} in www/index.html`);
  }
  const end = source.indexOf(endAnchor, start + startAnchor.length);
  if (end < 0 || source.indexOf(endAnchor, end + endAnchor.length) !== -1) {
    throw new Error(`Characterization source: expected exactly one end anchor ${endAnchor} for ${name}`);
  }
  const extracted = source.slice(start, end).trim();
  // A moved boundary must not silently swallow another declaration or runtime code.
  if (!extracted.endsWith('}') || /\n(?:async )?function |\n(?:const|let) /.test(extracted)) {
    throw new Error(`Characterization source: unexpected function boundary for ${name}`);
  }
  return extracted;
}

const boundaries = [
  ['uniqClean', 'function textForMetadata('],
  ['textForMetadata', 'function hasAny('],
  ['hasAny', 'function inferGlobalMovementPatterns('],
  ['inferGlobalMovementPatterns', 'function inferGlobalMuscles('],
  ['exerciseMovementTypes', 'function exerciseWorkoutPurposes('],
  ['normalizePrescriptionType', 'function formatPrescription('],
  ['formatPrescription', 'function movementTypePrescriptionDefaults('],
  ['movementTypePrescriptionDefaults', 'function effectiveExerciseDefaults('],
  ['effectiveExerciseDefaults', 'function inferDefaultPrescription('],
  ['inferDefaultPrescription', 'function prescriptionSecondsFromText('],
  ['prescriptionSecondsFromText', 'const REP_WHEEL_VALUES='],
  ['repValueFromPrescription', 'function isPerSidePrescription('],
  ['isPerSidePrescription', 'function timeWheelValueForRow('],
  ['isHoldStyleMovement', 'function getActiveItems('],
  ['getActiveItems', 'let ytPlayer='],
  ['formatClock', 'function updateTimer('],
  ['updateTimer', 'function configureTimerForExercise('],
  ['configureTimerForExercise', 'function startTimer('],
  ['stopTimer', 'function resetTimer('],
];

export function createRuntime(source = applicationSource) {
  const functions = boundaries.map(([name, end]) => extractFunction(source, name, end)).join('\n');
  const elements = new Map();
  const clearedIntervals = [];
  const context = vm.createContext({
    // Only external effects are replaced: DOM elements and interval cancellation.
    el(id) {
      if (!elements.has(id)) {
        const classes = new Set();
        elements.set(id, { textContent: '', classList: {
          toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
          contains(name) { return classes.has(name); },
        } });
      }
      return elements.get(id);
    },
    clearInterval(handle) { clearedIntervals.push(handle); },
  });
  const runtime = vm.runInContext(`
    let exercises = [], activeCircuit = null;
    let timerHandle = null, timerRemaining = 0, timerElapsed = 0;
    let timerTarget = 0, activeTimerMode = 'countdown';
    ${functions}
    ({
      ${boundaries.map(([name]) => name).join(', ')},
      setCircuit(library, circuit) { exercises = library; activeCircuit = circuit; },
      setTimerState(state) {
        timerHandle = state.handle ?? null;
        timerRemaining = state.remaining ?? 0;
        timerElapsed = state.elapsed ?? 0;
        timerTarget = state.target ?? 0;
        activeTimerMode = state.mode ?? 'countdown';
      },
      timerState() { return { timerHandle, timerRemaining, timerElapsed, timerTarget, activeTimerMode }; }
    })
  `, context, { filename: 'www/index.html (extracted characterization functions)', timeout: 1000 });
  return { runtime, elements, clearedIntervals };
}

// Convert VM objects to this realm for strict structural assertions.
export const plain = value => JSON.parse(JSON.stringify(value));
