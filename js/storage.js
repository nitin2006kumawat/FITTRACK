const STORAGE_KEY = "fittrack.guest.v1";
const WATER_MIN = 250;
const WATER_MAX = 10000;
const ACTIVITY_MIN = 1;
const ACTIVITY_MAX = 600;
const BODY_WEIGHT_MIN = 1;
const BODY_WEIGHT_MAX = 500;
const NUTRITION_CALORIE_GOAL_MIN = 500;
const NUTRITION_CALORIE_GOAL_MAX = 10000;
const NUTRITION_MACRO_GOAL_MAX = 1000;
const DEFAULT_NUTRITION_GOALS = Object.freeze({ calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 });
const WORKOUT_TYPES = new Set(["Strength", "Cardio", "Yoga", "Mobility", "Other"]);
const PLAN_LOCATIONS = new Set(["Gym", "Home", "Flexible"]);

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

function isValidId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 80;
}

function isValidExerciseSet(set) {
  return set && typeof set === "object"
    && isValidId(set.id)
    && Number.isInteger(set.reps)
    && set.reps >= 1
    && set.reps <= 100
    && typeof set.weightKg === "number"
    && Number.isFinite(set.weightKg)
    && set.weightKg >= 0
    && set.weightKg <= 1000
    && Math.abs(set.weightKg * 10 - Math.round(set.weightKg * 10)) < 0.000001
    && typeof set.completed === "boolean";
}

function isValidSessionExercise(exercise) {
  return exercise && typeof exercise === "object"
    && isValidId(exercise.id)
    && typeof exercise.name === "string"
    && exercise.name.trim().length > 0
    && exercise.name.length <= 80
    && Array.isArray(exercise.sets)
    && exercise.sets.length >= 1
    && exercise.sets.length <= 20
    && exercise.sets.every(isValidExerciseSet);
}

function isValidPlanExercise(exercise) {
  return exercise && typeof exercise === "object"
    && isValidId(exercise.id)
    && typeof exercise.name === "string"
    && exercise.name.trim().length > 0
    && exercise.name.length <= 80
    && Number.isInteger(exercise.sets)
    && exercise.sets >= 1
    && exercise.sets <= 20
    && Number.isInteger(exercise.reps)
    && exercise.reps >= 1
    && exercise.reps <= 100;
}

function isValidPlan(plan) {
  return plan && typeof plan === "object"
    && isValidId(plan.id)
    && typeof plan.name === "string"
    && plan.name.trim().length > 0
    && plan.name.length <= 60
    && PLAN_LOCATIONS.has(plan.location)
    && Array.isArray(plan.days)
    && plan.days.length >= 1
    && plan.days.length <= 7
    && plan.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && new Set(plan.days).size === plan.days.length
    && Array.isArray(plan.exercises)
    && plan.exercises.length >= 1
    && plan.exercises.length <= 12
    && plan.exercises.every(isValidPlanExercise)
    && isValidTimestamp(plan.createdAt);
}

function isValidActiveWorkout(workout) {
  return workout && typeof workout === "object"
    && isValidId(workout.id)
    && typeof workout.name === "string"
    && workout.name.trim().length > 0
    && workout.name.length <= 60
    && WORKOUT_TYPES.has(workout.type)
    && Number.isInteger(workout.caloriesBurned)
    && workout.caloriesBurned >= 0
    && workout.caloriesBurned <= 5000
    && (workout.planId === null || isValidId(workout.planId))
    && isValidTimestamp(workout.startedAt)
    && Array.isArray(workout.exercises)
    && workout.exercises.length <= 12
    && workout.exercises.every(isValidSessionExercise);
}

export function createInitialData() {
  return {
    version: 1,
    goals: { waterMl: 2500, activityMinutes: 30 },
    waterEntries: [],
    weightEntries: [],
    nutritionGoals: { ...DEFAULT_NUTRITION_GOALS },
    nutritionEntries: [],
    workouts: [],
    plans: [],
    activeWorkout: null,
  };
}

function isValidWaterEntry(entry) {
  return entry && typeof entry === "object"
    && isValidId(entry.id)
    && Number.isInteger(entry.amountMl)
    && entry.amountMl >= 50
    && entry.amountMl <= 5000
    && isValidTimestamp(entry.createdAt);
}

function isValidWeightEntry(entry) {
  return entry && typeof entry === "object"
    && isValidId(entry.id)
    && isValidDateKey(entry.date)
    && typeof entry.weightKg === "number"
    && Number.isFinite(entry.weightKg)
    && entry.weightKg >= BODY_WEIGHT_MIN
    && entry.weightKg <= BODY_WEIGHT_MAX
    && Math.abs(entry.weightKg * 10 - Math.round(entry.weightKg * 10)) < 0.000001;
}

function isValidNutritionGoals(goals) {
  const isValidMacroGoal = (value) => typeof value === "number"
    && Number.isFinite(value)
    && value >= 1
    && value <= NUTRITION_MACRO_GOAL_MAX
    && Math.abs(value * 10 - Math.round(value * 10)) < 0.000001;
  return goals && typeof goals === "object"
    && Number.isInteger(goals.calories)
    && goals.calories >= NUTRITION_CALORIE_GOAL_MIN
    && goals.calories <= NUTRITION_CALORIE_GOAL_MAX
    && isValidMacroGoal(goals.proteinG)
    && isValidMacroGoal(goals.carbsG)
    && isValidMacroGoal(goals.fatG);
}

function isValidNutritionEntry(entry) {
  const isValidMacroAmount = (value) => typeof value === "number"
    && Number.isFinite(value)
    && value >= 0
    && value <= 300
    && Math.abs(value * 10 - Math.round(value * 10)) < 0.000001;
  return entry && typeof entry === "object"
    && isValidId(entry.id)
    && typeof entry.name === "string"
    && entry.name.trim().length > 0
    && entry.name.length <= 80
    && isValidDateKey(entry.date)
    && Number.isInteger(entry.calories)
    && entry.calories >= 0
    && entry.calories <= 5000
    && isValidMacroAmount(entry.proteinG)
    && isValidMacroAmount(entry.carbsG)
    && isValidMacroAmount(entry.fatG)
    && isValidTimestamp(entry.createdAt);
}

function isValidWorkout(entry) {
  return entry && typeof entry === "object"
    && isValidId(entry.id)
    && typeof entry.name === "string"
    && entry.name.trim().length > 0
    && entry.name.length <= 60
    && WORKOUT_TYPES.has(entry.type)
    && Number.isInteger(entry.durationMinutes)
    && entry.durationMinutes >= 1
    && entry.durationMinutes <= 600
    && Number.isInteger(entry.caloriesBurned)
    && entry.caloriesBurned >= 0
    && entry.caloriesBurned <= 5000
    && (entry.exercises === undefined || (Array.isArray(entry.exercises) && entry.exercises.length <= 12 && entry.exercises.every(isValidSessionExercise)))
    && isValidTimestamp(entry.createdAt);
}

function isValidData(data) {
  return data && typeof data === "object"
    && data.version === 1
    && data.goals && typeof data.goals === "object"
    && Number.isInteger(data.goals.waterMl)
    && data.goals.waterMl >= WATER_MIN
    && data.goals.waterMl <= WATER_MAX
    && Number.isInteger(data.goals.activityMinutes)
    && data.goals.activityMinutes >= ACTIVITY_MIN
    && data.goals.activityMinutes <= ACTIVITY_MAX
    && Array.isArray(data.waterEntries)
    && data.waterEntries.every(isValidWaterEntry)
    && (data.weightEntries === undefined || (Array.isArray(data.weightEntries) && data.weightEntries.every(isValidWeightEntry)))
    && (data.nutritionGoals === undefined || isValidNutritionGoals(data.nutritionGoals))
    && (data.nutritionEntries === undefined || (Array.isArray(data.nutritionEntries) && data.nutritionEntries.every(isValidNutritionEntry)))
    && Array.isArray(data.workouts)
    && data.workouts.every(isValidWorkout)
    && (data.plans === undefined || (Array.isArray(data.plans) && data.plans.every(isValidPlan)))
    && (data.activeWorkout === undefined || data.activeWorkout === null || isValidActiveWorkout(data.activeWorkout));
}

export function loadGuestData() {
  let savedData;

  try {
    savedData = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error("FITTRACK could not access this browser's local storage. Check your browser privacy settings, then reload.");
  }

  if (savedData === null) {
    return createInitialData();
  }

  let data;
  try {
    data = JSON.parse(savedData);
  } catch {
    throw new Error("FITTRACK found unreadable guest data and did not overwrite it. Clear this site's saved data in your browser settings to start fresh.");
  }

  return normalizeGuestData(data);
}

export function normalizeGuestData(data) {
  if (!isValidData(data)) {
    throw new Error("FITTRACK found guest data with an unsupported or invalid format and did not overwrite it. Clear this site's saved data in your browser settings to start fresh.");
  }
  const initialData = createInitialData();
  return {
    ...initialData,
    ...data,
    weightEntries: data.weightEntries || [],
    nutritionGoals: data.nutritionGoals || initialData.nutritionGoals,
    nutritionEntries: data.nutritionEntries || [],
    plans: data.plans || [],
    activeWorkout: data.activeWorkout || null,
  };
}

export function hasStoredGuestData() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    throw new Error("FITTRACK could not access this browser's local storage. Check your browser privacy settings, then reload.");
  }
}

export function saveGuestData(data) {
  if (!isValidData(data)) {
    throw new Error("FITTRACK could not save this entry because its data is invalid. Check the form values and try again.");
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new Error("FITTRACK could not save your guest data. Check browser storage permissions or free some device storage, then try again.");
  }
}
