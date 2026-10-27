const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
}

const goalFactors = {
  cut: 0.85,
  recomp: 0.95,
  gain: 1.08,
}

const round5 = n => Math.round(n / 5) * 5
const finite = n => Number.isFinite(Number(n)) ? Number(n) : 0

export function profileWeightKg(profile, fallbackWeight, unit = 'kg') {
  const entered = finite(profile?.weightKg)
  if (entered > 0) return entered
  const fallback = finite(fallbackWeight)
  if (fallback <= 0) return 0
  return unit === 'lb' ? fallback / 2.2046226218 : fallback
}

export function nutritionTargets(profile, fallbackWeight, unit = 'kg') {
  const weightKg = profileWeightKg(profile, fallbackWeight, unit)
  const heightCm = finite(profile?.heightCm)
  const age = finite(profile?.age)
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return null

  // Mifflin–St Jeor is only the starting estimate. Once enough food/weight history exists,
  // this can be replaced by an adaptive expenditure derived from the user's own trend.
  const sexOffset = profile?.sex === 'female' ? -161 : 5
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset
  const tdee = bmr * (activityFactors[profile?.activity] || activityFactors.moderate)
  const calories = round5(tdee * (goalFactors[profile?.goal] || goalFactors.recomp))
  const proteinPerKg = profile?.goal === 'gain' ? 1.8 : 2
  const protein = Math.round(weightKg * proteinPerKg)
  const fat = Math.round(weightKg * 0.8)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { calories, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee), weightKg }
}

export function foodNutrients(food) {
  const factor = Math.max(0, finite(food?.grams)) / 100
  return {
    calories: finite(food?.calories100) * factor,
    protein: finite(food?.protein100) * factor,
    carbs: finite(food?.carbs100) * factor,
    fat: finite(food?.fat100) * factor,
  }
}

export function nutritionTotals(entries = [], day) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  for (const entry of entries) {
    if (!entry || (day && entry.d !== day)) continue
    const values = foodNutrients(entry)
    for (const key of Object.keys(totals)) totals[key] += values[key]
  }
  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key])
  return totals
}

export function nutritionRemaining(targets, totals) {
  if (!targets) return null
  return Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map(key => [key, Math.max(0, Math.round(targets[key] - (totals?.[key] || 0)))]))
}

export function profileComplete(profile, fallbackWeight, unit = 'kg') {
  return !!nutritionTargets(profile, fallbackWeight, unit)
}

// A practical default day built from ordinary foods. These are reference values, not a branded
// database: the screen tells the user to prefer the package label when it differs. Rice, chicken
// and vegetables are cooked weights; oats are dry, and banana is the edible part.
export const PLAN_FOODS = {
  oats: { key: 'oats', name: 'Oats', meal: 'Breakfast', basis: 'dry', swapBy: 'carbs', calories100: 389, protein100: 16.9, carbs100: 66.3, fat100: 6.9, alternatives: [
    { name: 'Whole-grain bread', basis: 'served', carbs100: 43 }, { name: 'Cooked quinoa', basis: 'cooked', carbs100: 21.3 }, { name: 'Cooked rice', basis: 'cooked', carbs100: 28.2 },
  ] },
  yogurt: { key: 'yogurt', name: 'Greek yogurt 0%', meal: 'Breakfast', basis: 'served', swapBy: 'protein', calories100: 59, protein100: 10.3, carbs100: 3.6, fat100: 0.4, alternatives: [
    { name: 'Skyr', basis: 'served', protein100: 11 }, { name: 'Low-fat cottage cheese', basis: 'served', protein100: 12.4 }, { name: 'Whey protein powder', basis: 'dry', protein100: 80 },
  ] },
  eggs: { key: 'eggs', name: 'Whole eggs', meal: 'Breakfast', basis: 'edible', swapBy: 'protein', calories100: 143, protein100: 12.6, carbs100: 0.7, fat100: 9.5, alternatives: [
    { name: 'Egg whites', basis: 'served', protein100: 10.9 }, { name: 'Firm tofu', basis: 'served', protein100: 12 }, { name: 'Low-fat cottage cheese', basis: 'served', protein100: 12.4 },
  ] },
  banana: { key: 'banana', name: 'Banana', meal: 'Snack', basis: 'edible', swapBy: 'carbs', calories100: 89, protein100: 1.1, carbs100: 23, fat100: 0.3, alternatives: [
    { name: 'Apple', basis: 'edible', carbs100: 13.8 }, { name: 'Orange', basis: 'edible', carbs100: 11.8 }, { name: 'Mango', basis: 'edible', carbs100: 15 },
  ] },
  rice: { key: 'rice', name: 'Cooked rice', meal: 'Lunch and dinner', basis: 'cooked', swapBy: 'carbs', calories100: 130, protein100: 2.7, carbs100: 28.2, fat100: 0.3, alternatives: [
    { name: 'Cooked pasta', basis: 'cooked', carbs100: 30.9 }, { name: 'Boiled potatoes', basis: 'cooked', carbs100: 20.1 }, { name: 'Cooked sweet potato', basis: 'cooked', carbs100: 20.7 },
  ] },
  chicken: { key: 'chicken', name: 'Cooked chicken breast', meal: 'Lunch and dinner', basis: 'cooked', swapBy: 'protein', calories100: 165, protein100: 31, carbs100: 0, fat100: 3.6, alternatives: [
    { name: 'Cooked turkey breast', basis: 'cooked', protein100: 29 }, { name: 'Tuna in water, drained', basis: 'drained', protein100: 25.5 }, { name: 'Cooked lean beef', basis: 'cooked', protein100: 26 },
  ] },
  vegetables: { key: 'vegetables', name: 'Mixed vegetables', meal: 'Lunch and dinner', basis: 'cooked', swapBy: 'grams', calories100: 35, protein100: 2, carbs100: 7, fat100: 0.2, alternatives: [
    { name: 'Broccoli', basis: 'cooked' }, { name: 'Zucchini', basis: 'cooked' }, { name: 'Green beans', basis: 'cooked' },
  ] },
  oil: { key: 'oil', name: 'Olive oil', meal: 'Lunch and dinner', basis: 'served', swapBy: 'fat', calories100: 884, protein100: 0, carbs100: 0, fat100: 100, alternatives: [
    { name: 'Avocado', basis: 'edible', fat100: 14.7 }, { name: 'Almonds', basis: 'served', fat100: 49.9 }, { name: 'Peanut butter', basis: 'served', fat100: 50 },
  ] },
}

const amount = (food, grams) => ({ ...food, grams: Math.max(0, Math.round(grams / 5) * 5) })
const sumPlan = items => nutritionTotals(items)

export function dailyFoodPlan(targets) {
  if (!targets) return []
  const oatsG = Math.min(100, Math.max(40, targets.carbs * 0.18 / (PLAN_FOODS.oats.carbs100 / 100)))
  const fixed = [
    amount(PLAN_FOODS.oats, oatsG), amount(PLAN_FOODS.yogurt, 250),
    amount(PLAN_FOODS.eggs, 100), amount(PLAN_FOODS.banana, 120),
    amount(PLAN_FOODS.vegetables, 300),
  ]
  const afterFixed = sumPlan(fixed)
  const rice = amount(PLAN_FOODS.rice, (targets.carbs - afterFixed.carbs) / (PLAN_FOODS.rice.carbs100 / 100))
  const afterRice = sumPlan([...fixed, rice])
  const chicken = amount(PLAN_FOODS.chicken, (targets.protein - afterRice.protein) / (PLAN_FOODS.chicken.protein100 / 100))
  const afterChicken = sumPlan([...fixed, rice, chicken])
  const oil = amount(PLAN_FOODS.oil, targets.fat - afterChicken.fat)
  return [...fixed, rice, chicken, oil]
}

export function dailyFoodPlanTotals(targets) {
  return sumPlan(dailyFoodPlan(targets))
}

export function foodAlternatives(food) {
  if (!food?.alternatives?.length) return []
  return food.alternatives.map(alt => {
    const grams = food.swapBy === 'grams'
      ? food.grams
      : food.grams * finite(food[`${food.swapBy}100`]) / finite(alt[`${food.swapBy}100`])
    return { ...alt, grams: round5(grams) }
  })
}

