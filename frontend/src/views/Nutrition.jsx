import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { lastBW } from '../lib/history.js'
import { todayISO, uid } from '../lib/format.js'
import { dailyFoodPlan, dailyFoodPlanTotals, foodNutrients, nutritionRemaining, nutritionTargets, nutritionTotals, profileComplete, profileWeightKg } from '../lib/nutrition.js'
import { t } from '../lib/i18n.js'
import { Button, Segmented } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { starterPlanSheet } from '../sheets.jsx'

const EMPTY_FOOD = { name: '', grams: 100, calories100: '', protein100: '', carbs100: '', fat100: '' }
const n = value => Number(String(value).replace(',', '.')) || 0
const pct = (value, target) => Math.min(100, target > 0 ? Math.round(value / target * 100) : 0)

function Macro({ label, value, target, unit = 'g', color }) {
  return <div className="nut-macro">
    <div className="row between"><span>{label}</span><span className="small muted">{Math.round(value)} / {target} {unit}</span></div>
    <div className="nut-track"><i style={{ width: `${pct(value, target)}%`, background: color }} /></div>
  </div>
}

const basisLabel = basis => ({
  dry: t('dry weight'),
  cooked: t('cooked weight'),
  edible: t('edible portion'),
  served: t('as served'),
}[basis] || '')

function SuggestedMeal({ title, items, divisor = 1 }) {
  return <div className="nut-meal">
    <div className="ttl">{title}</div>
    <div className="nut-meal-foods">{items.map(item => {
      const grams = item.grams / divisor
      const extra = item.key === 'eggs' ? ` · ${t('about 2 eggs')}` : ''
      return <div className="nut-meal-food" key={item.key}>
        <span>{t(item.name)}</span>
        <strong>{grams} g</strong>
        <span className="ss">{basisLabel(item.basis)}{extra}</span>
      </div>
    })}</div>
  </div>
}

function ProfileForm({ initial, weight, unit, onSave, onCancel }) {
  const [p, setP] = useState(() => ({
    goal: 'recomp', sex: 'male', age: '', heightCm: '', weightKg: profileWeightKg(initial, weight, unit) ? Math.round(profileWeightKg(initial, weight, unit) * 10) / 10 : '',
    activity: 'moderate', trainingDays: 3, ...initial,
  }))
  const valid = n(p.age) >= 14 && n(p.heightCm) >= 120 && n(p.weightKg) >= 30
  const field = (key, label, props = {}) => <label className="nut-field"><span>{label}</span><input className="input" value={p[key]} onChange={e => setP({ ...p, [key]: e.target.value })} {...props} /></label>

  return <div className="narrow">
    <div className="hdr"><div><h1>{t('Your goal')}</h1><div className="sub">{t('We use this to calculate your starting calories and macros.')}</div></div>{onCancel && <button className="iconbtn" onClick={onCancel} aria-label={t('Cancel')}><Icon name="xmark" /></button>}</div>
    <div className="card">
      <div className="lbl2" style={{ marginBottom: 8 }}>{t('Goal')}</div>
      <Segmented value={p.goal} onChange={goal => setP({ ...p, goal })} options={[
        { value: 'cut', label: t('Lose fat') }, { value: 'recomp', label: t('Recomposition') }, { value: 'gain', label: t('Gain muscle') },
      ]} />
    </div>
    <div className="card nut-form">
      <div className="nut-grid">
        <label className="nut-field"><span>{t('Sex used by the formula')}</span><select className="input" value={p.sex} onChange={e => setP({ ...p, sex: e.target.value })}><option value="male">{t('Male')}</option><option value="female">{t('Female')}</option></select></label>
        {field('age', t('Age'), { inputMode: 'numeric' })}
        {field('heightCm', t('Height (cm)'), { inputMode: 'decimal' })}
        {field('weightKg', t('Weight (kg)'), { inputMode: 'decimal' })}
        <label className="nut-field"><span>{t('Daily activity')}</span><select className="input" value={p.activity} onChange={e => setP({ ...p, activity: e.target.value })}>
          <option value="sedentary">{t('Mostly seated')}</option><option value="light">{t('Lightly active')}</option><option value="moderate">{t('Moderately active')}</option><option value="high">{t('Very active')}</option>
        </select></label>
        <label className="nut-field"><span>{t('Training days per week')}</span><select className="input" value={p.trainingDays} onChange={e => setP({ ...p, trainingDays: n(e.target.value) })}>{[2, 3, 4, 5, 6].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
      </div>
      <div className="muted small" style={{ margin: '14px 0' }}>{t('This is a starting estimate, not a medical prescription. We will adjust it from your weight trend and actual intake.')}</div>
      <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...p, age: n(p.age), heightCm: n(p.heightCm), weightKg: n(p.weightKg), trainingDays: n(p.trainingDays), updatedAt: Date.now() })}>{t('Calculate my plan')}</Button>
    </div>
  </div>
}

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const latestWeight = lastBW(S)?.w || 0
  const nutrition = S.nutrition || { profile: null, foods: [] }
  const [editing, setEditing] = useState(false)
  const [food, setFood] = useState(EMPTY_FOOD)
  const day = todayISO()
  const complete = profileComplete(nutrition.profile, latestWeight, S.unit)
  const targets = useMemo(() => nutritionTargets(nutrition.profile, latestWeight, S.unit), [nutrition.profile, latestWeight, S.unit])
  const foods = Array.isArray(nutrition.foods) ? nutrition.foods : []
  const todayFoods = foods.filter(x => x.d === day)
  const totals = useMemo(() => nutritionTotals(foods, day), [foods, day])
  const remaining = nutritionRemaining(targets, totals)
  const suggestedFoods = useMemo(() => dailyFoodPlan(targets), [targets])
  const suggestedTotals = useMemo(() => dailyFoodPlanTotals(targets), [targets])
  const mealFoods = {
    breakfast: suggestedFoods.filter(x => x.meal === 'Breakfast'),
    snack: suggestedFoods.filter(x => x.meal === 'Snack'),
    main: suggestedFoods.filter(x => x.meal === 'Lunch and dinner'),
  }

  const saveProfile = profile => {
    update(st => { st.nutrition = { ...(st.nutrition || {}), profile, foods: st.nutrition?.foods || [] } })
    setEditing(false)
  }
  if (!complete || editing) return <ProfileForm initial={nutrition.profile} weight={latestWeight} unit={S.unit} onSave={saveProfile} onCancel={complete ? () => setEditing(false) : null} />

  const addFood = e => {
    e.preventDefault()
    if (!food.name.trim() || n(food.grams) <= 0) return
    const entry = { id: uid(), d: day, t: Date.now(), name: food.name.trim(), grams: n(food.grams), calories100: n(food.calories100), protein100: n(food.protein100), carbs100: n(food.carbs100), fat100: n(food.fat100) }
    update(st => {
      if (!st.nutrition) st.nutrition = { profile: nutrition.profile, foods: [] }
      if (!Array.isArray(st.nutrition.foods)) st.nutrition.foods = []
      st.nutrition.foods.push(entry)
    })
    setFood(EMPTY_FOOD)
  }
  const remove = id => update(st => { st.nutrition.foods = (st.nutrition?.foods || []).filter(x => x.id !== id) })

  return <div className="narrow">
    <div className="hdr"><div><h1>{t('Nutrition')}</h1><div className="sub">{t('Today')}</div></div><div className="row"><button className="iconbtn" onClick={() => setEditing(true)} aria-label={t('Edit goal')}><Icon name="target" /></button><button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="house" /></button></div></div>

    <div className="card nut-hero">
      <div className="row between"><div><div className="lbl2">{t('Calories')}</div><div className="big">{totals.calories} <span className="muted" style={{ fontSize: 16 }}>/ {targets.calories} kcal</span></div></div><div className="nut-ring" style={{ '--p': pct(totals.calories, targets.calories) }}><span>{pct(totals.calories, targets.calories)}%</span></div></div>
      <div className="muted small" style={{ marginTop: 6 }}>{remaining.calories ? t('{0} kcal remaining today', remaining.calories) : t('Daily calorie target reached')}</div>
      <div className="nut-macros">
        <Macro label={t('Protein')} value={totals.protein} target={targets.protein} color="var(--blue)" />
        <Macro label={t('Carbohydrates')} value={totals.carbs} target={targets.carbs} color="var(--orange)" />
        <Macro label={t('Fat')} value={totals.fat} target={targets.fat} color="var(--purple)" />
      </div>
    </div>

    <div className="card">
      <h2>{t('Suggested meals')}</h2>
      <div className="muted small" style={{ marginBottom: 14 }}>{t('An example day with exact amounts adjusted to your calorie and macro target.')}</div>
      <div className="nut-meal-list">
        <SuggestedMeal title={t('Breakfast')} items={mealFoods.breakfast} />
        <SuggestedMeal title={t('Snack')} items={mealFoods.snack} />
        <SuggestedMeal title={t('Lunch')} items={mealFoods.main} divisor={2} />
        <SuggestedMeal title={t('Dinner')} items={mealFoods.main} divisor={2} />
      </div>
      <div className="nut-plan-total">
        <div className="lbl2">{t('Daily plan total')}</div>
        <div>{suggestedTotals.calories} kcal · {suggestedTotals.protein} g {t('protein')} · {suggestedTotals.carbs} g {t('carbs')} · {suggestedTotals.fat} g {t('fat')}</div>
      </div>
      <div className="muted small" style={{ marginTop: 12 }}>{t('These are reference foods and amounts. Use the package label when its values differ, and swap foods as needed while keeping the same daily totals.')}</div>
    </div>

    <div className="card">
      <h2>{t('Add weighed food')}</h2>
      <div className="muted small" style={{ marginBottom: 12 }}>{t('Use the values on the label per 100 g, then enter the grams shown by your kitchen scale.')}</div>
      <form className="nut-form" onSubmit={addFood}>
        <label className="nut-field"><span>{t('Food')}</span><input className="input" placeholder={t('e.g. cooked chicken breast')} value={food.name} onChange={e => setFood({ ...food, name: e.target.value })} /></label>
        <div className="nut-grid nut-grid-food">
          {[
            ['grams', t('Grams')], ['calories100', t('kcal / 100 g')], ['protein100', t('Protein / 100 g')], ['carbs100', t('Carbs / 100 g')], ['fat100', t('Fat / 100 g')],
          ].map(([key, label]) => <label className="nut-field" key={key}><span>{label}</span><input className="input" inputMode="decimal" value={food[key]} onChange={e => setFood({ ...food, [key]: e.target.value })} /></label>)}
        </div>
        <Button variant="primary" icon="plus" type="submit" disabled={!food.name.trim() || n(food.grams) <= 0}>{t('Add food')}</Button>
      </form>
    </div>

    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}><h2 style={{ margin: 0 }}>{t("Today's food")}</h2><span className="small muted">{todayFoods.length}</span></div>
      {!todayFoods.length ? <div className="muted small">{t('Nothing logged yet. Weigh your first food and add it above.')}</div> : <div className="nut-food-list">{todayFoods.map(item => {
        const values = foodNutrients(item)
        return <div className="nut-food" key={item.id}><div className="grow"><div className="ttl">{item.name}</div><div className="ss">{item.grams} g · {Math.round(values.calories)} kcal · {Math.round(values.protein)} g {t('protein')}</div></div><button className="iconbtn" onClick={() => remove(item.id)} aria-label={t('Delete')}><Icon name="trash" /></button></div>
      })}</div>}
    </div>

    {!S.routines.length && <div className="card"><div className="row" style={{ gap: 9 }}><span className="lrow-i"><Icon name="dumbbell" /></span><div><div className="ttl">{t('Your training plan')}</div><div className="ss">{t('For your goal, start with a progressive strength plan on the days you can train.')}</div></div></div><div style={{ height: 12 }} /><Button icon="sparkles" onClick={starterPlanSheet}>{t('Choose my routine')}</Button></div>}
  </div>
}

