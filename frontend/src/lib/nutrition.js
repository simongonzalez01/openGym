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

