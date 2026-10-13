import assert from 'node:assert/strict'
import { test } from 'node:test'

import { proteinSplit } from '../src/lib/proteinSplit.ts'

// The worked example the rule was decided on, the same table as the server's
// test_typed_protein_comes_out_of_fat_before_carbs: 80 kg, 1,800 kcal, 176 g
// worked out. Fat's quarter is 50 g and its minimum 40 g.
const split = (protein: number) => proteinSplit(1800, 80, 176, protein)

test('the worked-out protein leaves fat at its quarter', () => {
  assert.deepEqual(split(176), { protein: 176, carbs: 162, fat: 50, fatState: 'quarter', fits: true, maxProtein: 360 })
})

test('typed protein comes out of fat before carbs', () => {
  for (const [protein, carbs, fat] of [
    [200, 160, 40],
    [250, 110, 40],
    [300, 60, 40],
    [360, 0, 40],
  ] as const) {
    const result = split(protein)
    assert.deepEqual([result.carbs, result.fat, result.fits], [carbs, fat, true], `${protein} g`)
    assert.equal(result.fatState, 'minimum')
  }
})

test('fat gives way gradually, and carbs keep every gram until it reaches its minimum', () => {
  const result = split(185)
  assert.deepEqual([result.carbs, result.fat, result.fatState], [162, 46, 'less'])
})

test('protein past the most that fits is flagged', () => {
  const result = split(361)
  assert.deepEqual([result.carbs, result.fat, result.fits], [0, 40, false])
})

test('protein below the worked-out amount goes to carbs', () => {
  const result = split(150)
  assert.deepEqual([result.carbs, result.fat, result.fatState], [188, 50, 'quarter'])
})

test('at a low target fat is at its minimum before any protein is typed', () => {
  // A quarter of 1,200 kcal is 33 g, under 0.5 g/kg at 80 kg.
  assert.equal(proteinSplit(1200, 80, 144, 144).fatState, 'minimum')
})
