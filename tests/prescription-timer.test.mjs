import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationSource, createRuntime, extractFunction, plain } from './helpers/prescription-runtime.mjs';

test('source extraction rejects missing, duplicate, and moved boundaries', () => {
  assert.throws(() => extractFunction('', 'example', 'function next('), /exactly one function example/);
  assert.throws(() => extractFunction('function example() {}', 'example', 'function next('), /end anchor.*next/);
  assert.throws(() => extractFunction('function example() {}\nfunction example() {}\nfunction next(', 'example', 'function next('), /exactly one function example/);
  assert.throws(() => extractFunction('function example() {}\nconst surprise = 1;\nfunction next(', 'example', 'function next('), /unexpected function boundary/);
});

test('runtime fails clearly when a required production function is renamed', () => {
  assert.throws(() => createRuntime(applicationSource.replace('function configureTimerForExercise(', 'function renamedTimer(')), /configureTimerForExercise/);
});

for (const [text, seconds] of [
  ['12 reps', 0], ['8 / side', 0], ['30 sec', 30],
  ['45 seconds', 45], ['2 minutes', 120], ['1.5 min', 90], ['2.6 s', 3], ['', 0],
]) {
  test(`prescriptionSecondsFromText(${JSON.stringify(text)}) returns ${seconds}`, () => {
    assert.equal(createRuntime().runtime.prescriptionSecondsFromText(text), seconds);
  });
}

test('repetition and per-side formatting, classification, and picker values', () => {
  const { runtime: r } = createRuntime();
  assert.equal(r.formatPrescription('reps', 12), '12 reps');
  assert.equal(r.formatPrescription('per_side', 8), '8 / side');
  assert.equal(r.formatPrescription('timed', 30), '30 sec');
  assert.equal(r.normalizePrescriptionType({ prescription: '12 reps' }), 'reps');
  assert.equal(r.normalizePrescriptionType({ prescription: '8 / side' }), 'per_side');
  assert.equal(r.normalizePrescriptionType({ prescription: '30 sec' }), 'timed');
  assert.equal(r.repValueFromPrescription('12 reps'), 12);
  assert.equal(r.repValueFromPrescription('8 / side'), 8);
  assert.equal(r.repValueFromPrescription('26 reps'), '');
  assert.equal(r.isPerSidePrescription('8 / SIDE'), true);
  assert.equal(r.isPerSidePrescription('12 reps'), false);
});

for (const [name, category, expected] of [
  ['Back Squat', 'Squat', ['reps', '10 reps', 'manual', null]],
  ['Reverse Lunge', 'Lunge', ['per_side', '8 / side', 'manual', null]],
  ['Ankle Mobility', 'Mobility', ['timed', '30 sec', 'timed', 30]],
  ['Stationary Bike', 'Cyclical', ['timed', '60 sec', 'timed', 60]],
]) {
  test(`${name}: actual movement inference supplies prescription defaults`, () => {
    const { runtime: r } = createRuntime();
    const exercise = { name, category };
    const d = r.effectiveExerciseDefaults(exercise);
    assert.deepEqual([d.prescriptionType, d.prescription, d.mode, d.seconds], expected);
    assert.equal(r.inferDefaultPrescription(exercise), expected[1]);
  });
}

for (const [type, prescription] of [['reps', '12 reps'], ['per_side', '8 / side'], ['distance', '20 m']]) {
  test(`explicit ${type} defaults discard stale mobility timer metadata`, () => {
    const { runtime: r } = createRuntime();
    const d = r.effectiveExerciseDefaults({ name: 'Ankle Mobility', category: 'Mobility', prescriptionType: type, prescription, mode: 'timed', seconds: 60 });
    assert.equal(d.prescription, prescription);
    assert.equal(d.mode, 'manual');
    assert.equal(d.seconds, null);
  });
}

function activeItem(r, exercise, row) {
  r.setCircuit([{ id: 'movement-1', name: 'Movement', ...exercise }], {
    items: [{ exerciseId: 'movement-1', ...row }],
  });
  return r.getActiveItems()[0];
}

for (const [label, exercise, row, expected] of [
  ['repetitions', {}, { prescription: '12 reps' }, ['manual', null, null]],
  ['per-side', {}, { prescription: '8 / side' }, ['manual', null, null]],
  ['countdown from text', {}, { prescription: '1.5 min' }, ['timed', 'countdown', 90]],
  ['AMRAP from text', {}, { prescription: 'AMRAP 30 sec', amrapIntervalSeconds: 30 }, ['timed', 'amrap', 30]],
  ['EMOM from text', {}, { prescription: 'EMOM 10 min', emomMinutes: 10 }, ['timed', 'emom', 600]],
  ['explicit AMRAP', {}, { prescription: 'Maximum reps', timerMode: 'amrap', seconds: 45 }, ['timed', 'amrap', 45]],
  ['explicit EMOM', {}, { prescription: 'Every minute', timerMode: 'emom', seconds: 300 }, ['timed', 'emom', 300]],
  ['explicit countdown', {}, { prescription: 'Work', timerMode: 'countdown', seconds: 20 }, ['timed', 'countdown', 20]],
  ['named hold', { name: 'Squat Hold' }, { prescription: '30 sec', seconds: 30 }, ['manual', null, null]],
  ['embedded hold metadata', {}, { prescription: '8 reps', seconds: 30, programTimerBehavior: 'embedded_hold' }, ['manual', null, null]],
  ['embedded tempo metadata', {}, { prescription: '8 reps', programEmbeddedHoldOrTempo: '3 sec bottom' }, ['manual', null, null]],
  ['per-rep pause text', {}, { prescription: '8 reps · 3 sec each rep', seconds: 3 }, ['manual', null, null]],
]) {
  test(`active items: ${label}`, () => {
    const { runtime: r } = createRuntime();
    const item = activeItem(r, exercise, row);
    assert.deepEqual([item.mode, item.timerMode, item.seconds], expected);
    assert.equal(item.prescription, row.prescription);
    assert.equal(item.amrapIntervalSeconds, row.amrapIntervalSeconds || null);
    assert.equal(item.emomMinutes, row.emomMinutes || null);
  });
}

test('active items handle no circuit and skip deleted exercises', () => {
  const { runtime: r } = createRuntime();
  assert.deepEqual(plain(r.getActiveItems()), []);
  r.setCircuit([], { items: [{ exerciseId: 'deleted', prescription: '10 reps' }] });
  assert.deepEqual(plain(r.getActiveItems()), []);
});

for (const [label, row, seconds, mode, clock, modeLabel] of [
  ['repetitions', { prescription: '12 reps' }, 0, 'countdown', '00:00', ''],
  ['per-side', { prescription: '8 / side' }, 0, 'countdown', '00:00', ''],
  ['timed', { prescription: '90 sec' }, 90, 'countdown', '01:30', ''],
  ['hold', { prescription: '30 sec', programTimerBehavior: 'embedded_hold' }, 0, 'countdown', '00:00', ''],
  ['AMRAP', { prescription: 'AMRAP 45 sec' }, 45, 'amrap', '00:45', 'AMRAP'],
  ['EMOM', { prescription: 'EMOM 10 min' }, 600, 'emom', '00:00', 'EMOM'],
]) {
  test(`timer configuration after active-item resolution: ${label}`, () => {
    const { runtime: r, elements, clearedIntervals } = createRuntime();
    const item = activeItem(r, {}, row);
    r.setTimerState({ handle: 123, remaining: 7, elapsed: 22, target: 999, mode: 'emom' });
    r.configureTimerForExercise(item);
    assert.deepEqual(plain(r.timerState()), {
      timerHandle: null, timerRemaining: seconds, timerElapsed: 0, timerTarget: seconds, activeTimerMode: mode,
    });
    assert.deepEqual(clearedIntervals, [123]);
    assert.equal(elements.get('timer').textContent, clock);
    assert.equal(elements.get('timerStart').textContent, 'START TIMER');
    assert.equal(elements.get('timerModeLabel').textContent, modeLabel);
    assert.equal(elements.get('timerModeLabel').classList.contains('hidden'), !modeLabel);
    assert.equal(elements.get('timer').classList.contains('countdown-warning'), false);
  });
}

test('switching from EMOM to countdown clears the prior mode label', () => {
  const { runtime: r, elements } = createRuntime();
  r.configureTimerForExercise({ timerMode: 'emom', seconds: 600 });
  r.configureTimerForExercise({ timerMode: 'countdown', seconds: 5 });
  assert.equal(elements.get('timerModeLabel').textContent, '');
  assert.equal(elements.get('timerModeLabel').classList.contains('hidden'), true);
  assert.equal(elements.get('timer').textContent, '00:05');
  assert.equal(elements.get('timer').classList.contains('countdown-warning'), true);
});

// Existing edge cases are intentionally characterized, not corrected here.
test('existing edge case: stale seconds override timed prescription text', () => {
  const { runtime: r } = createRuntime();
  const exercise = { name: 'Bike', category: 'Cyclical', prescriptionType: 'timed', prescription: '30 sec', seconds: 90 };
  assert.equal(r.effectiveExerciseDefaults(exercise).seconds, 90);
  const item = activeItem(r, exercise, { prescription: '30 sec', seconds: 60 });
  assert.equal(item.seconds, 60);
  r.configureTimerForExercise(item);
  assert.equal(r.timerState().timerTarget, 60);
});

test('existing edge case: hold-style name suppresses an explicit countdown', () => {
  const { runtime: r } = createRuntime();
  const item = activeItem(r, { name: 'Isometric Squat Hold' }, { prescription: '30 sec', seconds: 30, timerMode: 'countdown' });
  assert.equal(item.timerMode, null);
  assert.equal(item.seconds, null);
});
