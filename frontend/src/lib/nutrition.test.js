import { describe, expect, it } from 'vitest'
import { dailyFoodPlan, dailyFoodPlanTotals, foodAlternatives, foodNutrients, nutritionRemaining, nutritionTargets, nutritionTotals, profileWeightKg } from './nutrition.js'

describe('nutrition targets', () => {
  it('starts from Mifflin–St Jeor and applies the selected goal', () => {
    const base = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' }
    expect(nutritionTargets({ ...base, goal: 'recomp' })).toMatchObject({ calories: 2620, protein: 160, fat: 64 })
    expect(nutritionTargets({ ...base, goal: 'cut' }).calories).toBeLessThan(nutritionTargets({ ...base, goal: 'recomp' }).calories)
    expect(nutritionTargets({ ...base, goal: 'gain' }).calories).toBeGreaterThan(nutritionTargets({ ...base, goal: 'recomp' }).calories)
  })

  it('uses the latest weigh-in and converts pounds when no profile weight was entered', () => {
    expect(profileWeightKg({}, 176.3698, 'lb')).toBeCloseTo(80, 3)
    expect(nutritionTargets({ sex: 'female', age: 35, heightCm: 165, activity: 'light', goal: 'recomp' }, 132.277, 'lb').weightKg).toBeCloseTo(60, 3)
  })
})

describe('food log math', () => {
  const rice = { d: '2026-10-27', grams: 150, calories100: 130, protein100: 2.7, carbs100: 28, fat100: 0.3 }

  it('scales per-100g nutrients by the weighed amount', () => {
    expect(foodNutrients(rice)).toEqual({ calories: 195, protein: 4.050000000000001, carbs: 42, fat: 0.44999999999999996 })
  })

  it('totals only the selected day and never reports negative remaining targets', () => {
    const totals = nutritionTotals([rice, { ...rice, d: '2026-10-26' }], '2026-10-27')
    expect(totals).toEqual({ calories: 195, protein: 4, carbs: 42, fat: 0 })
    expect(nutritionRemaining({ calories: 100, protein: 3, carbs: 50, fat: 10 }, totals)).toEqual({ calories: 0, protein: 0, carbs: 8, fat: 10 })
  })
})

describe('daily food quantities', () => {
  it('turns the macro target into practical gram amounts close to every target', () => {
    const targets = { calories: 2620, protein: 160, carbs: 351, fat: 64 }
    const plan = dailyFoodPlan(targets)
    const totals = dailyFoodPlanTotals(targets)
    expect(plan.map(x => x.key)).toEqual(['oats', 'yogurt', 'eggs', 'banana', 'vegetables', 'rice', 'chicken', 'oil'])
    expect(plan.every(x => x.grams >= 0 && x.grams % 5 === 0)).toBe(true)
    expect(totals.protein).toBeCloseTo(targets.protein, -1)
    expect(totals.carbs).toBeCloseTo(targets.carbs, -1)
    expect(totals.fat).toBeCloseTo(targets.fat, -1)
    expect(Math.abs(totals.calories - targets.calories)).toBeLessThan(100)
  })

  it('calculates substitute quantities from the food primary nutrient', () => {
    const [oats] = dailyFoodPlan({ calories: 2620, protein: 160, carbs: 351, fat: 64 })
    const alternatives = foodAlternatives(oats)
    expect(alternatives.map(x => x.name)).toEqual(['Whole-grain bread', 'Cooked quinoa', 'Cooked rice'])
    expect(alternatives.every(x => x.grams > 0 && x.grams % 5 === 0)).toBe(true)
    expect(Math.abs(alternatives[0].grams * alternatives[0].carbs100 / 100 - oats.grams * oats.carbs100 / 100)).toBeLessThan(1)
  })
})
