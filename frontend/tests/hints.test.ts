// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dismissedSavedMeals, dismissHint, dismissSavedMeal, isHintDismissed } from '../src/lib/dismissals.ts'
import { offerSavedMeal } from '../src/lib/hints.ts'

const offer = (count: number | undefined, name = 'Chicken rice', savedNames: string[] = [], dismissedNames: string[] = []) =>
  offerSavedMeal({ count, name, savedNames, dismissedNames })

test('the saved-meal tip starts at two logs before this one', () => {
  assert.equal(offer(0), false)
  assert.equal(offer(1), false)
  assert.equal(offer(2), true)
  assert.equal(offer(9), true)
})

test('no count from the server means no tip', () => {
  assert.equal(offer(undefined), false)
})

test('a blank name gets no tip', () => {
  assert.equal(offer(5, '   '), false)
})

test('a name already saved or closed is matched across case and spaces', () => {
  assert.equal(offer(3, 'Chicken rice', [' chicken RICE ']), false)
  assert.equal(offer(3, '  CHICKEN RICE', [], ['chicken rice']), false)
  assert.equal(offer(3, 'Chicken rice', ['Porridge'], ['tea']), true)
})

test('closed tips stay closed, and storage that throws shows them again', () => {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    configurable: true,
  })
  try {
    assert.equal(isHintDismissed('steps'), false)
    dismissHint('steps')
    assert.equal(isHintDismissed('steps'), true)
    assert.equal(isHintDismissed('saved_foods'), false)

    assert.deepEqual(dismissedSavedMeals(), [])
    dismissSavedMeal(' Chicken Rice ')
    dismissSavedMeal('chicken rice')
    dismissSavedMeal('Porridge')
    assert.deepEqual(dismissedSavedMeals(), ['chicken rice', 'porridge'])

    store.set('trackaholic_hint_saved_meal', '{not json')
    assert.deepEqual(dismissedSavedMeals(), [])

    const broken = () => {
      throw new Error('SecurityError')
    }
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: broken, setItem: broken, removeItem: broken },
      configurable: true,
    })
    dismissHint('saved_foods')
    assert.equal(isHintDismissed('saved_foods'), false)
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
