import {
  createInitialData,
  hasStoredGuestData,
  loadGuestData,
  normalizeGuestData,
  saveGuestData,
} from "./storage.js";
import { EXERCISES, EXERCISE_EQUIPMENT, EXERCISE_MUSCLE_GROUPS } from "./exercises.js";
import {
  deleteCurrentAccount,
  getCurrentSession,
  isSupabaseConfigured,
  loadCloudData,
  saveCloudData,
  signOut,
  subscribeToAuthChanges,
} from "./auth.js";

const menuToggle = document.querySelector(".menu-toggle");
const backdrop = document.querySelector(".sidebar-backdrop");
const navLinks = [...document.querySelectorAll(".nav-link, .brand, .profile-link")];
const views = [...document.querySelectorAll("[data-view]")];
const pageLabel = document.querySelector("#current-page-label");
const dateLabel = document.querySelector("#today-label");
const datePill = document.querySelector("#date-pill");
const greetingLabel = document.querySelector("#greeting-label");
const waterDialog = document.querySelector("#water-dialog");
const goalsDialog = document.querySelector("#goals-dialog");
const workoutForm = document.querySelector("#workout-form");
const waterForm = document.querySelector("#water-form");
const goalsForm = document.querySelector("#goals-form");
const weightForm = document.querySelector("#weight-form");
const nutritionForm = document.querySelector("#nutrition-form");
const nutritionGoalsForm = document.querySelector("#nutrition-goals-form");
const weightDateInput = document.querySelector("#weight-date");
const weightInput = document.querySelector("#weight-kg");
const nutritionDateInput = document.querySelector("#nutrition-date");
const weightRangeSelect = document.querySelector("#weight-chart-range");
const strengthExerciseSelect = document.querySelector("#strength-exercise-select");
const planForm = document.querySelector("#plan-form");
const addExerciseForm = document.querySelector("#add-exercise-form");
const planExerciseFields = document.querySelector("#plan-exercise-fields");
const restDurationSelect = document.querySelector("#rest-duration");
const appStatus = document.querySelector("#app-status");
const successStatus = document.querySelector("#success-status");
const exerciseDetailsDialog = document.querySelector("#exercise-details-dialog");
const exerciseSearch = document.querySelector("#exercise-search");
const exerciseMuscleFilter = document.querySelector("#exercise-muscle-filter");
const exerciseEquipmentFilter = document.querySelector("#exercise-equipment-filter");
const exerciseGrid = document.querySelector("#exercise-grid");
const workoutNameInput = document.querySelector("#workout-name");
const accountHeading = document.querySelector("#account-heading");
const accountMessage = document.querySelector("#account-message");
const accountStatus = document.querySelector("#account-status");
const accountLoginLink = document.querySelector("#account-login-link");
const accountRegisterLink = document.querySelector("#account-register-link");
const accountSyncButton = document.querySelector("#account-sync-button");
const accountSignOutButton = document.querySelector("#account-signout-button");
const accountDeleteButton = document.querySelector("#account-delete-button");
const deleteAccountDialog = document.querySelector("#delete-account-dialog");
const deleteAccountForm = document.querySelector("#delete-account-form");
const deleteAccountPassword = document.querySelector("#delete-account-password");
const cancelAccountDeletion = document.querySelector("#cancel-account-deletion");
const profileAvatar = document.querySelector("#profile-avatar");
const profileName = document.querySelector("#profile-name");
const profileMode = document.querySelector("#profile-mode");
const modeLabel = document.querySelector("#mode-label");
const guestPreviewNotice = document.querySelector("#guest-preview-notice");

const viewTitles = {
  dashboard: "Dashboard",
  workouts: "Workouts",
  plans: "Training plans",
  exercises: "Exercise library",
  progress: "Progress",
  nutrition: "Nutrition",
  water: "Water",
  profile: "Profile",
};

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
let state;
let storageError = null;
let successTimer;
let currentDayKey;
let restRemaining = Number(restDurationSelect.value);
let restEndsAt = null;
let restInterval;
let restHasStarted = false;
let selectedExerciseId = null;
let pendingExercise = null;
let currentUser = null;
let cloudSyncEnabled = false;
let accountDeletionInProgress = false;
let accountNotice = "";
let cloudSaveQueue = Promise.resolve();

try {
  state = loadGuestData();
} catch (error) {
  state = createInitialData();
  storageError = error;
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function setNavigationOpen(isOpen) {
  document.body.classList.toggle("nav-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  backdrop.tabIndex = isOpen ? 0 : -1;
}

function showView(viewId) {
  const selectedView = viewTitles[viewId] ? viewId : "dashboard";

  views.forEach((view) => {
    view.hidden = view.dataset.view !== selectedView;
  });

  navLinks.forEach((link) => {
    const isCurrent = link.hash === `#${selectedView}`;
    if (link.classList.contains("nav-link")) {
      link.classList.toggle("is-active", isCurrent);
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  });

  pageLabel.textContent = viewTitles[selectedView];
  document.title = `${viewTitles[selectedView]} · FITTRACK`;
  setNavigationOpen(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateDate() {
  const now = new Date();
  dateLabel.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now);
  datePill.textContent = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(now);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.querySelector("#dashboard-title").firstChild.textContent = greeting;
  greetingLabel.textContent = hour < 12 ? "YOUR FITNESS, IN FOCUS" : "MAKE TODAY COUNT";
}

function showError(message) {
  appStatus.textContent = message;
  appStatus.hidden = false;
}

function showSuccess(message) {
  window.clearTimeout(successTimer);
  successStatus.textContent = message;
  successStatus.hidden = false;
  successTimer = window.setTimeout(() => {
    successStatus.hidden = true;
  }, 3200);
}

function setStorageUnavailable() {
  showError(storageError.message);
  setStorageControlsDisabled(true);
}

function setStorageControlsDisabled(isDisabled) {
  document.querySelectorAll("#workout-form input, #workout-form select, #workout-form button, #add-exercise-form input, #add-exercise-form button, #plan-form input, #plan-form select, #plan-form button, #water-form input, #water-form button[type='submit'], #goals-form input, #goals-form button[type='submit'], #weight-form input, #weight-form button, #nutrition-form input, #nutrition-form button, #nutrition-goals-form input, #nutrition-goals-form button, #nutrition-date, [data-remove-type='weight'], [data-remove-type='nutrition'], [data-open-water], [data-open-goals], [data-finish-workout], [data-cancel-workout], [data-timer-toggle], [data-timer-reset], [data-add-set], [data-remove-set], [data-remove-exercise], [data-start-plan], [data-remove-plan], [data-add-plan-exercise], [data-remove-plan-exercise], [data-add-library-exercise]").forEach((control) => {
    control.disabled = isDisabled
      || (control.matches("[data-start-plan]") && Boolean(state.activeWorkout))
      || (control.matches("[data-add-library-exercise]") && Boolean(state.activeWorkout && state.activeWorkout.exercises.length >= 12));
  });
}

function persist(nextState, message) {
  try {
    saveGuestData(nextState);
  } catch (error) {
    showError(error.message);
    return false;
  }

  state = nextState;
  appStatus.hidden = true;
  render();
  if (currentUser && cloudSyncEnabled) queueCloudSave(nextState, currentUser.id);
  showSuccess(message);
  return true;
}

function renderAccount() {
  const isConfigured = isSupabaseConfigured();
  const userName = currentUser
    ? String(currentUser.user_metadata?.full_name || "").trim() || currentUser.email || "FITTRACK athlete"
    : "Guest athlete";
  accountHeading.textContent = currentUser ? userName : "Guest mode";
  accountMessage.textContent = currentUser
    ? cloudSyncEnabled
      ? `${currentUser.email || "Signed in"} · Your fitness data is saved to this account and on this device.`
      : `${currentUser.email || "Signed in"} · Device data stays local until you choose to sync.`
    : "Your data is saved in this browser. Sign in or create an account to sync it between devices.";
  profileName.textContent = userName;
  profileAvatar.textContent = userName.slice(0, 1).toUpperCase();
  profileMode.textContent = currentUser
    ? cloudSyncEnabled ? "Synced account" : "Account · device only"
    : "Guest mode";
  modeLabel.textContent = currentUser
    ? cloudSyncEnabled ? "CLOUD SYNC ON" : "ACCOUNT"
    : "GUEST MODE";
  guestPreviewNotice.hidden = Boolean(currentUser);

  accountLoginLink.hidden = Boolean(currentUser);
  accountRegisterLink.hidden = Boolean(currentUser);
  accountSyncButton.hidden = !currentUser || cloudSyncEnabled;
  accountSyncButton.disabled = Boolean(storageError);
  accountSignOutButton.hidden = !currentUser;
accountDeleteButton.hidden = !currentUser;
accountSyncButton.disabled = accountDeletionInProgress || Boolean(storageError);
accountSignOutButton.disabled = accountDeletionInProgress;
accountDeleteButton.disabled = accountDeletionInProgress;
  const notice = accountNotice || (!isConfigured
    ? "Account access needs a Supabase project URL and publishable key in js/supabase-config.js. Never use a service-role key here."
    : "");
  accountStatus.textContent = notice;
  accountStatus.hidden = !notice;
}

function mergeFitnessData(deviceData, cloudData) {
  const mergeEntries = (cloudEntries, deviceEntries) => {
    const entries = new Map(cloudEntries.map((entry) => [entry.id, entry]));
    deviceEntries.forEach((entry) => entries.set(entry.id, entry));
    return [...entries.values()];
  };
  return {
    ...cloudData,
    ...deviceData,
    goals: deviceData.goals,
    nutritionGoals: deviceData.nutritionGoals,
    waterEntries: mergeEntries(cloudData.waterEntries, deviceData.waterEntries),
    weightEntries: mergeEntries(cloudData.weightEntries, deviceData.weightEntries),
    nutritionEntries: mergeEntries(cloudData.nutritionEntries, deviceData.nutritionEntries),
    workouts: mergeEntries(cloudData.workouts, deviceData.workouts),
    plans: mergeEntries(cloudData.plans, deviceData.plans),
    activeWorkout: deviceData.activeWorkout || cloudData.activeWorkout,
  };
}

function saveCloudOwner(userId) {
  try {
    window.localStorage.setItem("fittrack.cloud-owner.v1", userId);
  } catch {
    throw new Error("Cloud data synced, but FITTRACK could not remember this account on the device. Check browser storage permissions.");
  }
}
function clearDeletedAccountLocalData(deletedUserId) {
  const ownerId = window.localStorage.getItem("fittrack.cloud-owner.v1");

  if (ownerId !== deletedUserId) {
    return false;
  }

  window.localStorage.removeItem("fittrack.guest.v1");
  window.localStorage.removeItem("fittrack.cloud-owner.v1");

  state = createInitialData();
  return true;
}
function queueCloudSave(data, userId) {
  cloudSaveQueue = cloudSaveQueue.then(async () => {
    if (
  accountDeletionInProgress ||
  !currentUser ||
  currentUser.id !== userId ||
  !cloudSyncEnabled
) return;
    await saveCloudData(data);
    saveCloudOwner(userId);
    accountNotice = "Your latest changes are synced to your account.";
    renderAccount();
  }).catch((error) => {
    cloudSyncEnabled = false;
    accountNotice = `Cloud sync failed. Your data is still saved on this device. ${error.message}`;
    renderAccount();
    showError(accountNotice);
  });
}
async function waitForPendingCloudSaves() {
  await cloudSaveQueue;
}
async function applyAccountSession(user) {
  if (accountDeletionInProgress) return;
  if (!user) {
    currentUser = null;
    cloudSyncEnabled = false;
    accountNotice = "";
    renderAccount();
    return;
  }

  if (currentUser?.id === user.id) {
    currentUser = user;
    renderAccount();
    return;
  }

  currentUser = user;
  cloudSyncEnabled = false;
  if (storageError) {
    accountNotice = "Signed in, but this device's data could not be read, so it was not synced.";
    renderAccount();
    return;
  }
  accountNotice = "Checking your private account data…";
  renderAccount();

  try {
    const hasDeviceData = hasStoredGuestData();
    const ownerId = window.localStorage.getItem("fittrack.cloud-owner.v1");
    const cloudPayload = await loadCloudData();
    if (cloudPayload) {
      const cloudData = normalizeGuestData(cloudPayload);
      if (!hasDeviceData) {
        saveGuestData(cloudData);
        state = cloudData;
        cloudSyncEnabled = true;
        saveCloudOwner(user.id);
        accountNotice = "Your account data is synced to this device.";
      } else {
        const shouldMerge = ownerId === user.id || window.confirm(
          "FITTRACK found saved data on this device and data in your account. Merge both sets of entries and sync them?"
        );
        if (shouldMerge) {
          const mergedData = normalizeGuestData(mergeFitnessData(state, cloudData));
          saveGuestData(mergedData);
          state = mergedData;
          await saveCloudData(state);
          cloudSyncEnabled = true;
          saveCloudOwner(user.id);
          accountNotice = "Device and account entries have been merged and synced.";
        } else {
          accountNotice = "Signed in. Device data has not been merged or uploaded.";
        }
      }
    } else {
      const shouldSync = !hasDeviceData || ownerId === user.id || window.confirm(
        "Sync the fitness data saved on this device to your new account?"
      );
      if (shouldSync) {
        await saveCloudData(state);
        cloudSyncEnabled = true;
        saveCloudOwner(user.id);
        accountNotice = "This device is now synced to your account.";
      } else {
        accountNotice = "Signed in. Device data remains private on this device until you choose to sync it.";
      }
    }
    render();
  } catch (error) {
    cloudSyncEnabled = false;
    accountNotice = `Account sync is unavailable. Your local data is unchanged. ${error.message}`;
    renderAccount();
  }
}

async function syncAccountData() {
  if (accountDeletionInProgress || !currentUser || storageError) return;
  accountSyncButton.disabled = true;
  accountNotice = "Merging device and account data…";
  renderAccount();
  try {
    const cloudPayload = await loadCloudData();
    const cloudData = cloudPayload ? normalizeGuestData(cloudPayload) : createInitialData();
    const mergedData = normalizeGuestData(mergeFitnessData(state, cloudData));
    saveGuestData(mergedData);
    state = mergedData;
    await saveCloudData(state);
    cloudSyncEnabled = true;
    saveCloudOwner(currentUser.id);
    accountNotice = "Device and account entries have been merged and synced.";
    render();
  } catch (error) {
    accountNotice = `Sync failed. Your data remains saved on this device. ${error.message}`;
    renderAccount();
    showError(accountNotice);
  }
}

async function initializeAccount() {
  renderAccount();
  if (!isSupabaseConfigured()) return;

  try {
    const session = await getCurrentSession();
    await applyAccountSession(session?.user || null);
    await subscribeToAuthChanges((_event, nextSession) => {
      applyAccountSession(nextSession?.user || null);
    });
  } catch (error) {
    accountNotice = `Account access failed. Guest mode is still available. ${error.message}`;
    renderAccount();
  }
}

function todayWaterEntries() {
  const today = localDateKey(new Date());
  return state.waterEntries
    .filter((entry) => localDateKey(entry.createdAt) === today)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

function todayWorkouts() {
  const today = localDateKey(new Date());
  return state.workouts.filter((entry) => localDateKey(entry.createdAt) === today);
}

function renderDashboard() {
  const workouts = todayWorkouts();
  const waterEntries = todayWaterEntries();
  const activityMinutes = workouts.reduce((total, entry) => total + entry.durationMinutes, 0);
  const caloriesBurned = workouts.reduce((total, entry) => total + entry.caloriesBurned, 0);
  const waterMl = waterEntries.reduce((total, entry) => total + entry.amountMl, 0);
  const movementPercent = Math.min(100, Math.round((activityMinutes / state.goals.activityMinutes) * 100));
  const waterPercent = Math.min(100, Math.round((waterMl / state.goals.waterMl) * 100));

  document.querySelector("#activity-minutes").textContent = formatNumber(activityMinutes);
  document.querySelector("#activity-goal-label").textContent = `${formatNumber(activityMinutes)} / ${formatNumber(state.goals.activityMinutes)} min goal`;
  document.querySelector("#calories-burned").textContent = formatNumber(caloriesBurned);
  document.querySelector("#water-consumed").textContent = (waterMl / 1000).toFixed(1);
  document.querySelector("#water-goal").textContent = (state.goals.waterMl / 1000).toFixed(1);
  document.querySelector("#water-progress-bar").style.width = `${waterPercent}%`;
  const dashboardWaterProgress = document.querySelector(".stat-progress");
  dashboardWaterProgress.setAttribute("aria-valuenow", String(waterPercent));
  document.querySelector("#water-progress-label").textContent = `${waterPercent}% of daily goal`;
  document.querySelector("#movement-progress").textContent = String(movementPercent);
  document.querySelector("#movement-ring").style.setProperty("--progress", `${movementPercent}%`);
  document.querySelector("#movement-ring").setAttribute("aria-label", `Daily movement goal: ${movementPercent}% complete`);
  document.querySelector("#movement-goal-label").textContent = `${formatNumber(activityMinutes)} / ${formatNumber(state.goals.activityMinutes)} min`;

  renderWeeklyChart();
}

function renderWeeklyChart() {
  const chart = document.querySelector("#weekly-chart");
  const days = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = localDateKey(date);
    const minutes = state.workouts
      .filter((entry) => localDateKey(entry.createdAt) === key)
      .reduce((total, entry) => total + entry.durationMinutes, 0);
    days.push({ date, key, minutes });
  }

  const totalMinutes = days.reduce((total, day) => total + day.minutes, 0);
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));
  document.querySelector("#weekly-hours").textContent = (totalMinutes / 60).toFixed(1);
  chart.replaceChildren();

  days.forEach((day) => {
    const column = document.createElement("div");
    const value = document.createElement("span");
    const track = document.createElement("div");
    const bar = document.createElement("span");
    const label = document.createElement("span");
    const isToday = day.key === localDateKey(new Date());

    column.className = `chart-column${isToday ? " is-today" : ""}`;
    value.className = "chart-value";
    value.textContent = String(day.minutes);
    track.className = "chart-track";
    bar.style.height = `${day.minutes === 0 ? 0 : Math.max(7, (day.minutes / maxMinutes) * 100)}%`;
    track.append(bar);
    label.className = "chart-day";
    label.textContent = dayFormatter.format(day.date).toUpperCase();
    column.title = `${dayFormatter.format(day.date)}: ${day.minutes} active minutes`;
    column.append(value, track, label);
    chart.append(column);
  });

  const accessibleSummary = days.map((day) => `${dayFormatter.format(day.date)} ${day.minutes} minutes`).join(", ");
  chart.setAttribute("aria-label", `Logged activity over the last 7 days: ${accessibleSummary}`);
}

function createSvgIcon(pathData) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  path.setAttribute("d", pathData);
  icon.append(path);
  return icon;
}

function createRemoveButton(recordType, id, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "remove-entry";
  button.dataset.removeType = recordType;
  button.dataset.removeId = id;
  button.setAttribute("aria-label", `Remove ${label}`);
  button.append(createSvgIcon("M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"));
  return button;
}

function createEmptyList(title, description) {
  const empty = document.createElement("div");
  const heading = document.createElement("strong");
  const detail = document.createElement("span");
  empty.className = "entry-empty";
  heading.textContent = title;
  detail.textContent = description;
  empty.append(heading, detail);
  return empty;
}

function renderWorkoutList() {
  const list = document.querySelector("#workout-list");
  const records = [...state.workouts].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
  const count = records.length;
  document.querySelector("#workout-count").textContent = `${count} ${count === 1 ? "session" : "sessions"}`;
  list.replaceChildren();

  if (count === 0) {
    list.append(createEmptyList("No workouts logged yet", "Your saved sessions will show up here."));
    return;
  }

  records.forEach((record) => {
    const row = document.createElement("div");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const details = document.createElement("span");
    const trailing = document.createElement("span");
    const amount = document.createElement("span");
    const time = document.createElement("span");
    const exercises = Array.isArray(record.exercises) ? record.exercises : [];
    const totalSets = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    const completedSets = exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);

    row.className = "entry-row";
    icon.className = "entry-icon";
    icon.append(createSvgIcon("M6.5 8v8M4 10v4m13.5-6v8M20 10v4m-13.5-2h11"));
    copy.className = "entry-copy";
    name.textContent = record.name;
    details.textContent = `${record.type} · ${record.durationMinutes} min${exercises.length ? ` · ${exercises.length} exercises · ${completedSets}/${totalSets} sets` : ""}${record.caloriesBurned ? ` · ${formatNumber(record.caloriesBurned)} kcal` : ""}`;
    copy.append(name, details);
    if (exercises.length > 0) {
      const exerciseDetails = document.createElement("details");
      const summary = document.createElement("summary");
      const exerciseList = document.createElement("ul");
      exerciseDetails.className = "workout-history-details";
      summary.textContent = "Sets and weights";
      exerciseList.className = "workout-history-exercises";
      exercises.forEach((exercise) => {
        const item = document.createElement("li");
        const setSummary = exercise.sets
          .map((set) => `${set.reps} reps × ${set.weightKg} kg${set.completed ? " · done" : " · not done"}`)
          .join("; ");
        item.textContent = `${exercise.name}: ${setSummary}`;
        exerciseList.append(item);
      });
      exerciseDetails.append(summary, exerciseList);
      copy.append(exerciseDetails);
    }
    trailing.className = "entry-trailing";
    amount.className = "entry-amount";
    amount.textContent = `${record.durationMinutes} min`;
    time.className = "entry-time";
    time.textContent = historyDateFormatter.format(new Date(record.createdAt));
    trailing.append(amount, time);
    row.append(icon, copy, trailing, createRemoveButton("workout", record.id, record.name));
    list.append(row);
  });
}

function renderPlanOptions() {
  const select = document.querySelector("#workout-plan");
  const selectedPlanId = select.value;
  select.replaceChildren(new Option("Blank workout", ""));

  state.plans.forEach((plan) => {
    select.add(new Option(plan.name, plan.id));
  });

  if (state.plans.some((plan) => plan.id === selectedPlanId)) {
    select.value = selectedPlanId;
  }
}

function renderActiveWorkout() {
  const activeWorkout = state.activeWorkout;
  const setupGrid = document.querySelector("#workout-setup-grid");
  const panel = document.querySelector("#active-workout-panel");
  setupGrid.hidden = Boolean(activeWorkout);
  panel.hidden = !activeWorkout;

  if (!activeWorkout) return;

  document.querySelector("#active-workout-title").textContent = activeWorkout.name;
  document.querySelector("#active-workout-meta").textContent = `${activeWorkout.type} · Started ${timeFormatter.format(new Date(activeWorkout.startedAt))}`;
  updateElapsedTime();
  renderSessionExercises();
  renderRestTimer();
}

function updateElapsedTime() {
  const elapsed = state.activeWorkout
    ? Math.max(0, Math.floor((Date.now() - Date.parse(state.activeWorkout.startedAt)) / 1000))
    : 0;
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");
  document.querySelector("#elapsed-time").textContent = `${minutes}:${seconds}`;
}

function createSetRow(exercise, set, index) {
  const row = document.createElement("tr");
  const doneCell = document.createElement("td");
  const repsCell = document.createElement("td");
  const weightCell = document.createElement("td");
  const removeCell = document.createElement("td");
  const complete = document.createElement("input");
  const reps = document.createElement("input");
  const weight = document.createElement("input");
  const remove = document.createElement("button");
  const repsLabel = document.createElement("label");
  const weightLabel = document.createElement("label");

  row.className = set.completed ? "set-row is-complete" : "set-row";
  complete.type = "checkbox";
  complete.checked = set.completed;
  complete.setAttribute("aria-label", `Mark set ${index + 1} of ${exercise.name} complete`);
  complete.dataset.exerciseId = exercise.id;
  complete.dataset.setId = set.id;
  complete.dataset.setField = "completed";
  doneCell.append(complete);

  repsLabel.className = "visually-hidden";
  repsLabel.textContent = `Set ${index + 1} reps`;
  reps.type = "number";
  reps.min = "1";
  reps.max = "100";
  reps.step = "1";
  reps.value = String(set.reps);
  reps.setAttribute("aria-label", `Set ${index + 1} reps for ${exercise.name}`);
  reps.dataset.exerciseId = exercise.id;
  reps.dataset.setId = set.id;
  reps.dataset.setField = "reps";
  repsLabel.append(reps);
  repsCell.append(repsLabel);

  weightLabel.className = "visually-hidden";
  weightLabel.textContent = `Set ${index + 1} weight in kilograms`;
  weight.type = "number";
  weight.min = "0";
  weight.max = "1000";
  weight.step = "0.5";
  weight.value = String(set.weightKg);
  weight.setAttribute("aria-label", `Set ${index + 1} weight in kilograms for ${exercise.name}`);
  weight.dataset.exerciseId = exercise.id;
  weight.dataset.setId = set.id;
  weight.dataset.setField = "weightKg";
  weightLabel.append(weight);
  weightCell.append(weightLabel);

  remove.type = "button";
  remove.className = "remove-entry";
  remove.dataset.removeSet = "";
  remove.dataset.exerciseId = exercise.id;
  remove.dataset.setId = set.id;
  remove.setAttribute("aria-label", `Remove set ${index + 1} from ${exercise.name}`);
  remove.append(createSvgIcon("M5 12h14"));
  removeCell.append(remove);
  row.append(doneCell, repsCell, weightCell, removeCell);
  return row;
}

function renderSessionExercises() {
  const list = document.querySelector("#session-exercise-list");
  const exercises = state.activeWorkout.exercises;
  const completedSets = exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);
  const totalSets = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  document.querySelector("#active-exercise-count").textContent = `${exercises.length} ${exercises.length === 1 ? "exercise" : "exercises"} · ${completedSets}/${totalSets} sets`;
  list.replaceChildren();

  if (exercises.length === 0) {
    list.append(createEmptyList("Add your first exercise", "Add an exercise below, then track reps, weight, and completed sets."));
    return;
  }

  exercises.forEach((exercise) => {
    const card = document.createElement("article");
    const heading = document.createElement("div");
    const title = document.createElement("h4");
    const removeExercise = document.createElement("button");
    const tableWrap = document.createElement("div");
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const body = document.createElement("tbody");
    const addSet = document.createElement("button");

    card.className = "exercise-card";
    heading.className = "exercise-card-heading";
    title.textContent = exercise.name;
    removeExercise.type = "button";
    removeExercise.className = "remove-entry";
    removeExercise.dataset.removeExercise = exercise.id;
    removeExercise.setAttribute("aria-label", `Remove ${exercise.name} from workout`);
    removeExercise.append(createSvgIcon("M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"));
    heading.append(title, removeExercise);

    ["Done", "Reps", "Weight (kg)", ""].forEach((label) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headerRow.append(cell);
    });
    head.append(headerRow);
    exercise.sets.forEach((set, index) => body.append(createSetRow(exercise, set, index)));
    table.append(head, body);
    table.className = "sets-table";
    tableWrap.className = "exercise-table-wrap";
    tableWrap.append(table);

    addSet.type = "button";
    addSet.className = "inline-action add-set-action";
    addSet.dataset.addSet = exercise.id;
    addSet.textContent = "+ Add set";
    card.append(heading, tableWrap, addSet);
    list.append(card);
  });
}

function createExerciseIllustration(exercise, className) {
  const illustration = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  illustration.setAttribute("viewBox", "0 0 320 180");
  illustration.setAttribute("aria-hidden", "true");
  illustration.classList.add(className);
  use.setAttribute("href", `assets/exercise-illustrations.svg#${exercise.illustration}`);
  illustration.append(use);
  return illustration;
}

function renderExerciseCard(exercise) {
  const card = document.createElement("article");
  const figure = document.createElement("div");
  const difficulty = document.createElement("span");
  const content = document.createElement("div");
  const target = document.createElement("p");
  const title = document.createElement("h2");
  const summary = document.createElement("p");
  const equipment = document.createElement("p");
  const button = document.createElement("button");

  card.className = "exercise-library-card";
  figure.className = "exercise-card-visual";
  figure.append(createExerciseIllustration(exercise, "exercise-card-illustration"));
  difficulty.className = `exercise-difficulty difficulty-${exercise.difficulty.toLowerCase()}`;
  difficulty.textContent = exercise.difficulty;
  figure.append(difficulty);
  content.className = "exercise-card-content";
  target.className = "exercise-target";
  target.textContent = `${exercise.primaryMuscle}${exercise.secondaryMuscles.length ? ` · Also: ${exercise.secondaryMuscles.join(", ")}` : ""}`;
  title.textContent = exercise.name;
  summary.className = "exercise-card-summary";
  summary.textContent = exercise.summary;
  equipment.className = "exercise-card-equipment";
  equipment.textContent = exercise.equipment.join(" · ");
  button.type = "button";
  button.className = "button button-secondary exercise-detail-button";
  button.dataset.exerciseDetails = exercise.id;
  button.setAttribute("aria-haspopup", "dialog");
  button.textContent = "View instructions";
  content.append(target, title, summary, equipment, button);
  card.append(figure, content);
  return card;
}

function renderExerciseLibrary() {
  const searchTerm = exerciseSearch.value.trim().toLocaleLowerCase();
  const selectedMuscle = exerciseMuscleFilter.value;
  const selectedEquipment = exerciseEquipmentFilter.value;
  const filteredExercises = EXERCISES.filter((exercise) => {
    const searchText = [
      exercise.name,
      exercise.primaryMuscle,
      ...exercise.secondaryMuscles,
      ...exercise.equipment,
      exercise.difficulty,
      exercise.summary,
    ].join(" ").toLocaleLowerCase();
    const matchesSearch = !searchTerm || searchText.includes(searchTerm);
    const matchesMuscle = !selectedMuscle
      || exercise.primaryMuscle === selectedMuscle
      || exercise.secondaryMuscles.includes(selectedMuscle);
    const matchesEquipment = !selectedEquipment || exercise.equipment.includes(selectedEquipment);
    return matchesSearch && matchesMuscle && matchesEquipment;
  });

  document.querySelector("#exercise-results-count").textContent = `${filteredExercises.length} ${filteredExercises.length === 1 ? "exercise" : "exercises"}`;
  document.querySelector("#clear-exercise-filters").disabled = !searchTerm && !selectedMuscle && !selectedEquipment;
  const note = document.querySelector("#exercise-library-note");
  note.textContent = state.activeWorkout
    ? `Currently tracking: ${state.activeWorkout.name}. Add an exercise from its guide.`
    : "Choose an exercise and select Start with this exercise to begin a session.";
  exerciseGrid.replaceChildren();
  if (filteredExercises.length === 0) {
    const empty = document.createElement("div");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    empty.className = "exercise-no-results";
    title.textContent = "No exercises found";
    detail.textContent = "Try another search or clear the selected filters.";
    empty.append(title, detail);
    exerciseGrid.append(empty);
    return;
  }

  filteredExercises.forEach((exercise) => exerciseGrid.append(renderExerciseCard(exercise)));
}

function renderExerciseDetails(exerciseId) {
  const exercise = EXERCISES.find((item) => item.id === exerciseId);
  if (!exercise) {
    exerciseDetailsDialog.close();
    showError("That exercise could not be found. Clear the filters and try again.");
    return;
  }

  selectedExerciseId = exercise.id;
  document.querySelector("#exercise-detail-title").textContent = exercise.name;
  document.querySelector("#exercise-detail-summary").textContent = exercise.summary;
  const visual = document.querySelector("#exercise-detail-visual");
  visual.replaceChildren(createExerciseIllustration(exercise, "exercise-detail-illustration"));

  const facts = document.querySelector("#exercise-detail-facts");
  facts.replaceChildren();
  [
    ["Main target", exercise.primaryMuscle],
    ["Also works", exercise.secondaryMuscles.join(", ") || "—"],
    ["Equipment", exercise.equipment.join(", ")],
    ["Level", exercise.difficulty],
  ].forEach(([label, value]) => {
    const fact = document.createElement("div");
    const name = document.createElement("span");
    const content = document.createElement("strong");
    fact.className = "exercise-detail-fact";
    name.textContent = label;
    content.textContent = value;
    fact.append(name, content);
    facts.append(fact);
  });

  const instructions = document.querySelector("#exercise-instructions");
  instructions.replaceChildren();
  exercise.instructions.forEach((instruction) => {
    const item = document.createElement("li");
    item.textContent = instruction;
    instructions.append(item);
  });
  const cues = document.querySelector("#exercise-cues");
  cues.replaceChildren();
  exercise.coachingCues.forEach((cue) => {
    const item = document.createElement("li");
    item.textContent = cue;
    cues.append(item);
  });
  const addButton = document.querySelector("[data-add-library-exercise]");
  addButton.textContent = state.activeWorkout ? "Add to active workout" : "Start with this exercise";
  addButton.disabled = Boolean(storageError) || Boolean(state.activeWorkout && state.activeWorkout.exercises.length >= 12);
  if (state.activeWorkout && state.activeWorkout.exercises.length >= 12) {
    addButton.textContent = "Workout exercise limit reached";
  }
  exerciseDetailsDialog.showModal();
}

function populateExerciseFilters() {
  [
    [exerciseMuscleFilter, EXERCISE_MUSCLE_GROUPS],
    [exerciseEquipmentFilter, EXERCISE_EQUIPMENT],
  ].forEach(([select, options]) => {
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  });
}

function addLibraryExerciseToWorkout() {
  const exercise = EXERCISES.find((item) => item.id === selectedExerciseId);
  if (!exercise) {
    showError("That exercise could not be found. Close the guide and try again.");
    return;
  }

  if (state.activeWorkout) {
    if (state.activeWorkout.exercises.length >= 12) {
      showError("A workout can contain up to 12 exercises.");
      return;
    }
    const workoutExercise = { id: createId(), name: exercise.name, sets: [createSet(exercise.recommendedReps)] };
    if (persist({
      ...state,
      activeWorkout: { ...state.activeWorkout, exercises: [...state.activeWorkout.exercises, workoutExercise] },
    }, `${exercise.name} added to your workout.`)) {
      exerciseDetailsDialog.close();
      exerciseSearch.focus();
    }
    return;
  }

  pendingExercise = exercise;
  if (!workoutNameInput.value.trim()) workoutNameInput.value = `${exercise.name} session`;
  document.querySelector("#workout-type").value = "Strength";
  exerciseDetailsDialog.close();
  window.location.hash = "#workouts";
  showView("workouts");
  workoutNameInput.focus();
  showSuccess(`Start the session to add ${exercise.name}.`);
}

function formatRestTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function renderRestTimer() {
  document.querySelector("#timer-display").textContent = formatRestTime(restRemaining);
  document.querySelector("[data-timer-toggle]").textContent = restEndsAt ? "Pause" : "Start";
  document.querySelector("#rest-timer-status").textContent = restEndsAt
    ? "Timer running"
    : restRemaining === 0
      ? "Rest complete."
      : restHasStarted ? "Timer paused" : "Ready when you are.";
}

function renderPlanList() {
  const list = document.querySelector("#plan-list");
  const count = state.plans.length;
  document.querySelector("#plan-count").textContent = `${count} ${count === 1 ? "plan" : "plans"}`;
  list.replaceChildren();

  if (count === 0) {
    list.append(createEmptyList("No training plans yet", "Create a plan with exercises and a weekly schedule."));
    return;
  }

  state.plans.forEach((plan) => {
    const card = document.createElement("article");
    const header = document.createElement("div");
    const titleBlock = document.createElement("div");
    const title = document.createElement("h3");
    const location = document.createElement("span");
    const schedule = document.createElement("div");
    const exerciseList = document.createElement("ul");
    const actions = document.createElement("div");
    const start = document.createElement("button");
    const remove = document.createElement("button");

    card.className = "plan-card";
    header.className = "plan-card-heading";
    titleBlock.className = "plan-title-block";
    title.textContent = plan.name;
    location.className = "plan-location";
    location.textContent = plan.location;
    titleBlock.append(title, location);
    header.append(titleBlock);

    schedule.className = "plan-schedule";
    schedule.setAttribute("aria-label", "Weekly training schedule");
    plan.days.forEach((day) => {
      const dayTag = document.createElement("span");
      dayTag.textContent = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day];
      schedule.append(dayTag);
    });

    exerciseList.className = "plan-exercises";
    plan.exercises.forEach((exercise) => {
      const item = document.createElement("li");
      item.textContent = `${exercise.name} · ${exercise.sets} × ${exercise.reps}`;
      exerciseList.append(item);
    });

    actions.className = "plan-card-actions";
    start.type = "button";
    start.className = "button button-primary";
    start.dataset.startPlan = plan.id;
    start.disabled = Boolean(state.activeWorkout);
    start.textContent = "Start plan";
    remove.type = "button";
    remove.className = "remove-entry";
    remove.dataset.removePlan = plan.id;
    remove.setAttribute("aria-label", `Remove ${plan.name} plan`);
    remove.append(createSvgIcon("M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"));
    actions.append(start, remove);
    card.append(header, schedule, exerciseList, actions);
    list.append(card);
  });
}

function createSet(reps = 10, weightKg = 0, completed = false) {
  return { id: createId(), reps, weightKg, completed };
}

function createActiveWorkout(name, type, caloriesBurned, plan = null) {
  return {
    id: createId(),
    name,
    type,
    caloriesBurned,
    planId: plan ? plan.id : null,
    startedAt: new Date().toISOString(),
    exercises: plan
      ? plan.exercises.map((exercise) => ({
        id: createId(),
        name: exercise.name,
        sets: Array.from({ length: exercise.sets }, () => createSet(exercise.reps)),
      }))
      : [],
  };
}

function handleWorkoutSubmit(event) {
  event.preventDefault();
  const nameInput = document.querySelector("#workout-name");
  const name = nameInput.value.trim();
  if (!workoutForm.reportValidity()) return;
  if (!name) {
    showError("Enter a workout name.");
    nameInput.focus();
    return;
  }

  const formData = new FormData(workoutForm);
  const selectedPlanId = String(formData.get("plan"));
  const plan = selectedPlanId ? state.plans.find((item) => item.id === selectedPlanId) : null;
  if (selectedPlanId && !plan) {
    showError("That training plan is no longer available. Choose another plan or start with a blank workout.");
    return;
  }
  if (pendingExercise && plan && plan.exercises.length >= 12) {
    showError("This plan already has 12 exercises. Choose another plan or start a blank workout.");
    return;
  }

  const caloriesValue = formData.get("calories");
  const activeWorkout = createActiveWorkout(
    name,
    String(formData.get("type")),
    caloriesValue === "" ? 0 : Number(caloriesValue),
    plan,
  );
  if (pendingExercise) {
    activeWorkout.exercises.push({
      id: createId(),
      name: pendingExercise.name,
      sets: [createSet(pendingExercise.recommendedReps)],
    });
  }

  if (persist({ ...state, activeWorkout }, "Workout started. Your session is saved on this device.")) {
    pendingExercise = null;
    workoutForm.reset();
  }
}

function startPlan(planId) {
  if (state.activeWorkout) {
    showError("Finish or cancel your current workout before starting a training plan.");
    return;
  }

  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) {
    showError("That training plan could not be found. Refresh the page and try again.");
    return;
  }

  const activeWorkout = createActiveWorkout(plan.name, "Strength", 0, plan);
  if (persist({ ...state, activeWorkout }, `${plan.name} started.`)) {
    pendingExercise = null;
    window.location.hash = "#workouts";
  }
}

function finishWorkout() {
  const activeWorkout = state.activeWorkout;
  if (!activeWorkout) return;

  if (activeWorkout.exercises.length === 0) {
    showError("Add at least one exercise before finishing this workout.");
    document.querySelector("#session-exercise-name").focus();
    return;
  }

  const completedSets = activeWorkout.exercises.reduce((total, exercise) => (
    total + exercise.sets.filter((set) => set.completed).length
  ), 0);
  if (completedSets === 0) {
    showError("Mark at least one set as complete before finishing this workout.");
    return;
  }

  const finishedAt = new Date();
  const durationMinutes = Math.max(1, Math.ceil((finishedAt.getTime() - Date.parse(activeWorkout.startedAt)) / 60000));
  const workout = {
    id: activeWorkout.id,
    name: activeWorkout.name,
    type: activeWorkout.type,
    durationMinutes,
    caloriesBurned: activeWorkout.caloriesBurned,
    createdAt: finishedAt.toISOString(),
    exercises: activeWorkout.exercises,
  };

  if (persist({ ...state, activeWorkout: null, workouts: [workout, ...state.workouts] }, "Workout finished and added to your history.")) {
    stopRestTimer();
  }
}

function cancelWorkout() {
  if (!state.activeWorkout) return;
  if (!window.confirm("Cancel this workout? Its unsaved session details will be removed.")) return;
  if (persist({ ...state, activeWorkout: null }, "Workout cancelled.")) {
    stopRestTimer();
  }
}

function handleAddExercise(event) {
  event.preventDefault();
  if (!state.activeWorkout) return;
  const input = document.querySelector("#session-exercise-name");
  const name = input.value.trim();
  if (!addExerciseForm.reportValidity()) return;
  if (!name) {
    showError("Enter an exercise name.");
    input.focus();
    return;
  }
  if (state.activeWorkout.exercises.length >= 12) {
    showError("A workout can contain up to 12 exercises.");
    return;
  }

  const exercise = { id: createId(), name, sets: [createSet()] };
  if (persist({
    ...state,
    activeWorkout: { ...state.activeWorkout, exercises: [...state.activeWorkout.exercises, exercise] },
  }, `${name} added to your workout.`)) {
    addExerciseForm.reset();
    input.focus();
  }
}

function addSet(exerciseId) {
  const exercise = state.activeWorkout?.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  if (exercise.sets.length >= 20) {
    showError("An exercise can contain up to 20 sets.");
    return;
  }

  const previousSet = exercise.sets[exercise.sets.length - 1];
  const newExercise = {
    ...exercise,
    sets: [...exercise.sets, createSet(previousSet.reps, previousSet.weightKg)],
  };
  const exercises = state.activeWorkout.exercises.map((item) => item.id === exerciseId ? newExercise : item);
  persist({ ...state, activeWorkout: { ...state.activeWorkout, exercises } }, "Set added.");
}

function removeExercise(exerciseId) {
  const exercise = state.activeWorkout?.exercises.find((item) => item.id === exerciseId);
  if (!exercise || !window.confirm(`Remove ${exercise.name} and its sets from this workout?`)) return;

  const exercises = state.activeWorkout.exercises.filter((item) => item.id !== exerciseId);
  persist({ ...state, activeWorkout: { ...state.activeWorkout, exercises } }, `${exercise.name} removed.`);
}

function removeSet(exerciseId, setId) {
  const exercise = state.activeWorkout?.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  if (exercise.sets.length <= 1) {
    showError("An exercise needs at least one set. Remove the exercise if you do not need it.");
    return;
  }
  if (!window.confirm("Remove this set?")) return;

  const exercises = state.activeWorkout.exercises.map((item) => (
    item.id === exerciseId
      ? { ...item, sets: item.sets.filter((set) => set.id !== setId) }
      : item
  ));
  persist({ ...state, activeWorkout: { ...state.activeWorkout, exercises } }, "Set removed.");
}

function handleSetChange(event) {
  const input = event.target;
  const { exerciseId, setId, setField } = input.dataset;
  if (!setField || !state.activeWorkout) return;

  let value;
  if (setField === "completed") {
    value = input.checked;
  } else {
    if (!input.validity.valid) {
      showError(setField === "reps"
        ? "Reps must be a whole number between 1 and 100."
        : "Weight must be between 0 and 1,000 kg in 0.5 kg steps.");
      return;
    }
    value = input.valueAsNumber;
  }

  const exercises = state.activeWorkout.exercises.map((exercise) => (
    exercise.id === exerciseId
      ? {
        ...exercise,
        sets: exercise.sets.map((set) => set.id === setId ? { ...set, [setField]: value } : set),
      }
      : exercise
  ));
  persist({ ...state, activeWorkout: { ...state.activeWorkout, exercises } }, "Set saved.");
}

function tickRestTimer() {
  if (!restEndsAt) return;
  restRemaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
  if (restRemaining === 0) {
    window.clearInterval(restInterval);
    restInterval = null;
    restEndsAt = null;
    restHasStarted = false;
    showSuccess("Rest timer complete.");
  }
  renderRestTimer();
}

function toggleRestTimer() {
  if (restEndsAt) {
    restRemaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
    restEndsAt = null;
    window.clearInterval(restInterval);
    restInterval = null;
  } else {
    if (restRemaining === 0) restRemaining = Number(restDurationSelect.value);
    restEndsAt = Date.now() + restRemaining * 1000;
    restHasStarted = true;
    restInterval = window.setInterval(tickRestTimer, 250);
  }
  renderRestTimer();
}

function stopRestTimer() {
  window.clearInterval(restInterval);
  restInterval = null;
  restEndsAt = null;
  restRemaining = Number(restDurationSelect.value);
  restHasStarted = false;
  renderRestTimer();
}

function createPlanExerciseInput(index) {
  const row = document.createElement("div");
  const nameLabel = document.createElement("label");
  const nameInput = document.createElement("input");
  const setsLabel = document.createElement("label");
  const setsInput = document.createElement("input");
  const repsLabel = document.createElement("label");
  const repsInput = document.createElement("input");
  const remove = document.createElement("button");

  row.className = "plan-exercise-input";
  row.dataset.planExercise = "";
  nameLabel.className = "plan-exercise-name";
  nameLabel.append(document.createTextNode(`Exercise ${index + 1}`));
  nameInput.type = "text";
  nameInput.name = "exercise-name";
  nameInput.maxLength = 80;
  nameInput.placeholder = "e.g. Squat";
  nameInput.required = true;
  nameInput.autocomplete = "off";
  nameLabel.append(nameInput);

  setsLabel.append(document.createTextNode("Sets"));
  setsInput.type = "number";
  setsInput.name = "exercise-sets";
  setsInput.min = "1";
  setsInput.max = "20";
  setsInput.step = "1";
  setsInput.value = "3";
  setsInput.required = true;
  setsInput.inputMode = "numeric";
  setsLabel.append(setsInput);

  repsLabel.append(document.createTextNode("Reps"));
  repsInput.type = "number";
  repsInput.name = "exercise-reps";
  repsInput.min = "1";
  repsInput.max = "100";
  repsInput.step = "1";
  repsInput.value = "10";
  repsInput.required = true;
  repsInput.inputMode = "numeric";
  repsLabel.append(repsInput);

  remove.type = "button";
  remove.className = "remove-entry";
  remove.dataset.removePlanExercise = "";
  remove.setAttribute("aria-label", `Remove exercise ${index + 1} from plan`);
  remove.append(createSvgIcon("M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"));
  row.append(nameLabel, setsLabel, repsLabel, remove);
  return row;
}

function updatePlanExerciseControls() {
  const rows = [...planExerciseFields.querySelectorAll("[data-plan-exercise]")];
  rows.forEach((row, index) => {
    const remove = row.querySelector("[data-remove-plan-exercise]");
    remove.disabled = rows.length === 1;
    remove.setAttribute("aria-label", `Remove exercise ${index + 1} from plan`);
  });
  document.querySelector("[data-add-plan-exercise]").disabled = rows.length >= 12;
}

function addPlanExerciseInput() {
  const rows = planExerciseFields.querySelectorAll("[data-plan-exercise]");
  if (rows.length >= 12) {
    showError("A training plan can contain up to 12 exercises.");
    return;
  }
  const row = createPlanExerciseInput(rows.length);
  planExerciseFields.append(row);
  updatePlanExerciseControls();
  row.querySelector("input").focus();
}

function resetPlanForm() {
  planForm.reset();
  const rows = [...planExerciseFields.querySelectorAll("[data-plan-exercise]")];
  rows.slice(1).forEach((row) => row.remove());
  updatePlanExerciseControls();
}

function handlePlanSubmit(event) {
  event.preventDefault();
  const nameInput = document.querySelector("#plan-name");
  const name = nameInput.value.trim();

  const dayInputs = [...planForm.querySelectorAll("input[name='days']")];
  const selectedDays = dayInputs.filter((input) => input.checked).map((input) => Number(input.value));
  if (selectedDays.length === 0) {
    showError("Choose at least one training day for this plan.");
    dayInputs[0].focus();
    return;
  }
  if (!planForm.reportValidity()) return;

  const exerciseRows = [...planExerciseFields.querySelectorAll("[data-plan-exercise]")];
  const invalidExerciseName = exerciseRows
    .map((row) => row.querySelector("[name='exercise-name']"))
    .find((input) => !input.value.trim());
  if (!name) {
    showError("Enter a plan name.");
    nameInput.focus();
    return;
  }
  if (invalidExerciseName) {
    showError("Enter a name for each exercise in the plan.");
    invalidExerciseName.focus();
    return;
  }

  const exercises = exerciseRows.map((row) => ({
    id: createId(),
    name: row.querySelector("[name='exercise-name']").value.trim(),
    sets: Number(row.querySelector("[name='exercise-sets']").value),
    reps: Number(row.querySelector("[name='exercise-reps']").value),
  }));
  const formData = new FormData(planForm);
  const plan = {
    id: createId(),
    name,
    location: String(formData.get("location")),
    days: selectedDays.sort((first, second) => first - second),
    exercises,
    createdAt: new Date().toISOString(),
  };

  if (persist({ ...state, plans: [plan, ...state.plans] }, "Training plan saved on this device.")) {
    resetPlanForm();
  }
}

function removePlan(planId) {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan || !window.confirm(`Remove the ${plan.name} training plan?`)) return;
  persist({ ...state, plans: state.plans.filter((item) => item.id !== planId) }, "Training plan removed.");
}

function renderWaterList() {
  const list = document.querySelector("#water-list");
  const records = todayWaterEntries();
  const totalMl = records.reduce((total, entry) => total + entry.amountMl, 0);
  const progress = Math.min(100, Math.round((totalMl / state.goals.waterMl) * 100));
  const count = records.length;
  document.querySelector("#water-count").textContent = `${count} ${count === 1 ? "entry" : "entries"}`;
  document.querySelector("#water-page-consumed").textContent = formatNumber(totalMl);
  document.querySelector("#water-page-goal").textContent = formatNumber(state.goals.waterMl);
  document.querySelector("#water-page-progress").style.width = `${progress}%`;
  const progressTrack = document.querySelector(".water-progress-track");
  progressTrack.setAttribute("aria-valuenow", String(progress));
  document.querySelector("#water-page-progress-label").textContent = `${progress}% of today's goal`;
  list.replaceChildren();

  if (count === 0) {
    list.append(createEmptyList("No water logged today", "Use Add water to record your first glass."));
    return;
  }

  records.forEach((record) => {
    const row = document.createElement("div");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const details = document.createElement("span");
    const trailing = document.createElement("span");
    const amount = document.createElement("span");
    const time = document.createElement("span");

    row.className = "entry-row";
    icon.className = "entry-icon entry-icon-water";
    icon.append(createSvgIcon("M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z"));
    copy.className = "entry-copy";
    name.textContent = "Water";
    details.textContent = "Water intake";
    copy.append(name, details);
    trailing.className = "entry-trailing";
    amount.className = "entry-amount";
    amount.textContent = `${formatNumber(record.amountMl)} ml`;
    time.className = "entry-time";
    time.textContent = timeFormatter.format(new Date(record.createdAt));
    trailing.append(amount, time);
    row.append(icon, copy, trailing, createRemoveButton("water", record.id, `${record.amountMl} ml water entry`));
    list.append(row);
  });
}

function formatMacroAmount(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? formatNumber(rounded) : rounded.toFixed(1);
}

function renderNutritionMetric(key, consumed, goal, unit) {
  const isCalories = unit === "kcal";
  const formatAmount = isCalories ? formatNumber : formatMacroAmount;
  const progress = Math.min(100, Math.round((consumed / goal) * 100));
  const consumedLabel = document.querySelector(`#nutrition-${key}-consumed`);
  const goalLabel = document.querySelector(`#nutrition-${key}-goal`);
  const progressBar = document.querySelector(`#nutrition-${key}-progress`);
  const track = progressBar.parentElement;
  consumedLabel.textContent = formatAmount(consumed);
  goalLabel.textContent = formatAmount(goal);
  progressBar.style.width = `${progress}%`;
  track.setAttribute("aria-valuenow", String(progress));
  track.setAttribute("aria-valuetext", `${formatAmount(consumed)} of ${formatAmount(goal)} ${isCalories ? "kilocalories" : "grams"}`);

  return progress;
}

function renderNutrition() {
  const today = localDateKey(new Date());
  nutritionDateInput.max = today;
  if (!nutritionDateInput.value || !nutritionDateInput.validity.valid) nutritionDateInput.value = today;

  const selectedDate = nutritionDateInput.value;
  const goals = state.nutritionGoals;
  const entries = state.nutritionEntries
    .filter((entry) => entry.date === selectedDate)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
  const totals = entries.reduce((sum, entry) => ({
    calories: sum.calories + entry.calories,
    proteinG: sum.proteinG + entry.proteinG,
    carbsG: sum.carbsG + entry.carbsG,
    fatG: sum.fatG + entry.fatG,
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  totals.proteinG = Math.round(totals.proteinG * 10) / 10;
  totals.carbsG = Math.round(totals.carbsG * 10) / 10;
  totals.fatG = Math.round(totals.fatG * 10) / 10;

  renderNutritionMetric("calories", totals.calories, goals.calories, "kcal");
  renderNutritionMetric("protein", totals.proteinG, goals.proteinG, "g");
  renderNutritionMetric("carbs", totals.carbsG, goals.carbsG, "g");
  renderNutritionMetric("fat", totals.fatG, goals.fatG, "g");

  const calorieDifference = goals.calories - totals.calories;
  document.querySelector("#nutrition-calorie-caption").textContent = calorieDifference >= 0
    ? `${formatNumber(calorieDifference)} kcal remaining`
    : `${formatNumber(Math.abs(calorieDifference))} kcal over target`;
  nutritionGoalsForm.elements.calories.value = String(goals.calories);
  nutritionGoalsForm.elements.protein.value = String(goals.proteinG);
  nutritionGoalsForm.elements.carbs.value = String(goals.carbsG);
  nutritionGoalsForm.elements.fat.value = String(goals.fatG);

  const isToday = selectedDate === today;
  document.querySelector("#nutrition-log-heading").textContent = isToday
    ? "Today's food log"
    : `${formatWeightDate(selectedDate)} food log`;
  document.querySelector("#nutrition-log-caption").textContent = isToday
    ? "Entries are saved on this device."
    : "Food logged for this day is saved on this device.";
  document.querySelector("#nutrition-entry-count").textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  const list = document.querySelector("#nutrition-list");
  list.replaceChildren();
  if (entries.length === 0) {
    list.append(createEmptyList("No food logged yet", "Add a food entry to see today's calories and macros."));
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("div");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const details = document.createElement("span");
    const trailing = document.createElement("span");
    const calories = document.createElement("span");
    const time = document.createElement("span");

    row.className = "entry-row nutrition-entry-row";
    icon.className = "entry-icon nutrition-entry-icon";
    icon.append(createSvgIcon("M4 5h16M6 5l1 14h10l1-14M9 10h6m-6 4h6"));
    copy.className = "entry-copy";
    name.textContent = entry.name;
    details.textContent = `${formatMacroAmount(entry.proteinG)} g protein · ${formatMacroAmount(entry.carbsG)} g carbs · ${formatMacroAmount(entry.fatG)} g fat`;
    copy.append(name, details);
    trailing.className = "entry-trailing";
    calories.className = "entry-amount";
    calories.textContent = `${formatNumber(entry.calories)} kcal`;
    time.className = "entry-time";
    time.textContent = timeFormatter.format(new Date(entry.createdAt));
    trailing.append(calories, time);
    row.append(icon, copy, trailing, createRemoveButton("nutrition", entry.id, `${entry.name} food entry`));
    list.append(row);
  });
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatWeightDate(value) {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(dateFromKey(value));
}

function createChartElement(tagName, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function drawProgressChart(svg, points, metricName, gradientId) {
  const width = 640;
  const height = 260;
  const left = 64;
  const right = 622;
  const top = 24;
  const bottom = 194;
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin;
  const padding = spread === 0 ? Math.max(rawMax * 0.025, 0.5) : spread * 0.16;
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const range = Math.max(0.1, max - min);
  const xForIndex = (index) => points.length === 1
    ? (left + right) / 2
    : left + (index / (points.length - 1)) * (right - left);
  const yForValue = (value) => bottom - ((value - min) / range) * (bottom - top);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: xForIndex(index),
    y: yForValue(point.value),
  }));
  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${bottom} L ${coordinates[0].x.toFixed(1)} ${bottom} Z`;
  const defs = createChartElement("defs");
  const gradient = createChartElement("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "0", y2: "1" });
  const start = createChartElement("stop", { offset: "0%", "stop-color": "#c9f96a", "stop-opacity": "0.2" });
  const end = createChartElement("stop", { offset: "100%", "stop-color": "#c9f96a", "stop-opacity": "0" });
  const line = createChartElement("path", {
    d: linePath,
    fill: "none",
    stroke: "#c9f96a",
    "stroke-width": "3",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-label", `${metricName}: ${points.length} records, from ${formatWeightDate(points[0].date)} to ${formatWeightDate(points[points.length - 1].date)}.`);
  gradient.append(start, end);
  defs.append(gradient);
  svg.append(defs);

  for (let index = 0; index <= 3; index += 1) {
    const y = top + (index / 3) * (bottom - top);
    const value = max - (index / 3) * range;
    const gridline = createChartElement("line", {
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      class: "progress-chart-gridline",
    });
    const label = createChartElement("text", {
      x: left - 12,
      y: y + 4,
      "text-anchor": "end",
      class: "progress-chart-axis-label",
    });
    label.textContent = value.toFixed(1);
    svg.append(gridline, label);
  }

  const areaFill = createChartElement("path", { d: areaPath, fill: `url(#${gradientId})` });
  svg.append(areaFill, line);

  coordinates.forEach((point) => {
    const marker = createChartElement("circle", {
      cx: point.x,
      cy: point.y,
      r: "4.5",
      class: "progress-chart-point",
    });
    const title = createChartElement("title");
    title.textContent = `${formatWeightDate(point.date)}: ${point.value.toFixed(1)} kg`;
    marker.append(title);
    svg.append(marker);
  });

  const labelIndexes = new Set([0, coordinates.length - 1]);
  if (coordinates.length > 2) {
    for (let index = 1; index <= 3; index += 1) {
      labelIndexes.add(Math.round((index / 4) * (coordinates.length - 1)));
    }
  }
  [...labelIndexes].sort((first, second) => first - second).forEach((index) => {
    const point = coordinates[index];
    const label = createChartElement("text", {
      x: point.x,
      y: height - 19,
      "text-anchor": index === 0 ? "start" : index === coordinates.length - 1 ? "end" : "middle",
      class: "progress-chart-date-label",
    });
    label.textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(dateFromKey(point.date));
    svg.append(label);
  });
}

function renderBodyWeightHistory() {
  const list = document.querySelector("#weight-history-list");
  const entries = [...state.weightEntries].sort((first, second) => second.date.localeCompare(first.date));
  document.querySelector("#weight-entry-count").textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  list.replaceChildren();

  if (entries.length === 0) {
    list.append(createEmptyList("No check-ins yet", "Your saved body-weight entries will appear here."));
    return;
  }

  entries.forEach((record) => {
    const row = document.createElement("div");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const details = document.createElement("span");
    const trailing = document.createElement("span");
    const amount = document.createElement("span");
    const date = document.createElement("span");

    row.className = "entry-row";
    icon.className = "entry-icon";
    icon.append(createSvgIcon("M3 8h18v12H3zM7 8V5h10v3M7 12h3m4 0h3m-10 4h3m4 0h3"));
    copy.className = "entry-copy";
    name.textContent = "Body weight";
    details.textContent = formatWeightDate(record.date);
    copy.append(name, details);
    trailing.className = "entry-trailing";
    amount.className = "entry-amount";
    amount.textContent = `${record.weightKg.toFixed(1)} kg`;
    date.className = "entry-time";
    date.textContent = record.date === localDateKey(new Date()) ? "Today" : "Check-in";
    trailing.append(amount, date);
    row.append(icon, copy, trailing, createRemoveButton("weight", record.id, `${record.weightKg.toFixed(1)} kg body-weight entry`));
    list.append(row);
  });
}

function collectStrengthHistory() {
  const exercises = new Map();
  state.workouts.forEach((workout) => {
    const date = localDateKey(workout.createdAt);
    (workout.exercises || []).forEach((exercise) => {
      const completedSets = exercise.sets.filter((set) => set.completed && set.weightKg > 0);
      if (completedSets.length === 0) return;

      const key = exercise.name.trim().toLocaleLowerCase();
      if (!exercises.has(key)) {
        exercises.set(key, { name: exercise.name, byDate: new Map() });
      }
      const entry = exercises.get(key);
      const bestSet = completedSets.reduce((best, set) => (
        set.weightKg > best.weightKg || (set.weightKg === best.weightKg && set.reps > best.reps) ? set : best
      ));
      const previous = entry.byDate.get(date);
      if (!previous || bestSet.weightKg > previous.value || (bestSet.weightKg === previous.value && bestSet.reps > previous.reps)) {
        entry.byDate.set(date, { date, value: bestSet.weightKg, reps: bestSet.reps });
      }
    });
  });
  return exercises;
}

function renderStrengthChart(history) {
  const chart = document.querySelector("#strength-progress-chart");
  const empty = document.querySelector("#strength-progress-empty");
  const caption = document.querySelector("#strength-progress-caption");
  const exercise = history.get(strengthExerciseSelect.value);
  if (!exercise) {
    chart.setAttribute("hidden", "");
    empty.hidden = false;
    caption.textContent = "Only completed sets with added weight are included.";
    return;
  }

  const points = [...exercise.byDate.values()].sort((first, second) => first.date.localeCompare(second.date));
  empty.hidden = true;
  chart.removeAttribute("hidden");
  drawProgressChart(chart, points, `${exercise.name} heaviest completed set`, "strength-chart-fill");
  caption.textContent = points.length === 1
    ? "Complete another weighted workout for this exercise to see a trend."
    : `${points.length} workout dates · heaviest completed set, in kilograms.`;
}

function renderPersonalRecords(history) {
  const list = document.querySelector("#personal-record-list");
  const records = [...history.values()]
    .map((exercise) => ({
      name: exercise.name,
      ...[...exercise.byDate.values()].reduce((best, point) => (
        point.value > best.value || (point.value === best.value && point.reps > best.reps) ? point : best
      )),
    }))
    .sort((first, second) => second.value - first.value || second.date.localeCompare(first.date));
  document.querySelector("#personal-record-count").textContent = formatNumber(records.length);
  list.replaceChildren();

  if (records.length === 0) {
    list.append(createEmptyList("No strength PRs yet", "Complete a weighted set in a workout to record a personal best."));
    return;
  }

  records.forEach((record) => {
    const row = document.createElement("div");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const details = document.createElement("span");
    const value = document.createElement("span");
    row.className = "personal-record";
    copy.className = "personal-record-copy";
    title.textContent = record.name;
    details.textContent = `${record.reps} reps · ${formatWeightDate(record.date)}`;
    value.className = "personal-record-value";
    value.textContent = `${record.value.toFixed(1)} kg`;
    copy.append(title, details);
    row.append(copy, value);
    list.append(row);
  });
}

function renderStrengthProgress() {
  const history = collectStrengthHistory();
  const previousValue = strengthExerciseSelect.value;
  const exerciseOptions = [...history.entries()].sort((first, second) => first[1].name.localeCompare(second[1].name));
  strengthExerciseSelect.replaceChildren();

  if (exerciseOptions.length === 0) {
    strengthExerciseSelect.append(new Option("No weighted sets yet", ""));
    strengthExerciseSelect.disabled = true;
  } else {
    exerciseOptions.forEach(([key, exercise]) => strengthExerciseSelect.append(new Option(exercise.name, key)));
    strengthExerciseSelect.disabled = false;
    strengthExerciseSelect.value = history.has(previousValue) ? previousValue : exerciseOptions[0][0];
  }

  renderStrengthChart(history);
  renderPersonalRecords(history);
}

function renderBodyWeightChart() {
  const chart = document.querySelector("#body-weight-chart");
  const empty = document.querySelector("#body-weight-chart-empty");
  const caption = document.querySelector("#body-weight-chart-caption");
  const entries = [...state.weightEntries].sort((first, second) => first.date.localeCompare(second.date));
  const selectedRange = weightRangeSelect.value;
  let visibleEntries = entries;

  if (selectedRange !== "all" && entries.length > 0) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - Number(selectedRange) + 1);
    const cutoffKey = localDateKey(cutoff);
    visibleEntries = entries.filter((entry) => entry.date >= cutoffKey);
  }

  if (visibleEntries.length === 0) {
    chart.setAttribute("hidden", "");
    empty.hidden = false;
    caption.textContent = entries.length === 0
      ? "Body weight is stored on this device."
      : "No check-ins fall within this range. Choose a wider range to see older entries.";
    return;
  }

  empty.hidden = true;
  chart.removeAttribute("hidden");
  drawProgressChart(
    chart,
    visibleEntries.map((entry) => ({ date: entry.date, value: entry.weightKg })),
    "Body weight",
    "weight-chart-fill",
  );
  caption.textContent = `${visibleEntries.length} ${visibleEntries.length === 1 ? "check-in" : "check-ins"} shown · kilograms`;
}

function renderProgress() {
  const entries = [...state.weightEntries].sort((first, second) => second.date.localeCompare(first.date));
  const latest = entries[0];
  document.querySelector("#weight-latest").textContent = latest ? latest.weightKg.toFixed(1) : "--";
  document.querySelector("#weight-latest-date").textContent = latest ? formatWeightDate(latest.date) : "No check-ins yet";
  const change = document.querySelector("#weight-change");
  const changeCaption = document.querySelector("#weight-change-caption");
  if (entries.length >= 2) {
    const difference = latest.weightKg - entries[entries.length - 1].weightKg;
    change.textContent = `${difference > 0 ? "+" : ""}${difference.toFixed(1)} kg`;
    changeCaption.textContent = "Since your first check-in";
  } else {
    change.textContent = "--";
    changeCaption.textContent = "Log two check-ins to see a change";
  }

  document.querySelector("#progress-workout-count").textContent = formatNumber(state.workouts.length);
  weightDateInput.max = localDateKey(new Date());
  if (!weightDateInput.value) weightDateInput.value = localDateKey(new Date());
  renderBodyWeightChart();
  renderBodyWeightHistory();
  renderStrengthProgress();
}

function renderWaterDialog() {
  document.querySelector("#water-amount").value = "250";
}

function renderGoalsDialog() {
  document.querySelector("#activity-goal-input").value = String(state.goals.activityMinutes);
  document.querySelector("#water-goal-input").value = String(state.goals.waterMl);
}

function render() {
  updateDate();
  renderDashboard();
  renderExerciseLibrary();
  renderProgress();
  renderNutrition();
  renderAccount();
  renderPlanOptions();
  renderWorkoutList();
  renderActiveWorkout();
  renderPlanList();
  renderWaterList();

  if (storageError) {
    setStorageUnavailable();
  } else {
    setStorageControlsDisabled(false);
    updatePlanExerciseControls();
  }
}

function openDialog(dialog) {
  if (storageError || dialog.open) return;
  if (dialog === waterDialog) renderWaterDialog();
  if (dialog === goalsDialog) renderGoalsDialog();
  dialog.showModal();
}

function removeRecord(type, id) {
  const collections = { water: "waterEntries", workout: "workouts", weight: "weightEntries", nutrition: "nutritionEntries" };
  const collection = collections[type];
  if (!collection) return;
  const record = state[collection].find((entry) => entry.id === id);
  if (!record) return;

  const label = type === "water"
    ? `${record.amountMl} ml water entry`
    : type === "weight"
      ? `${record.weightKg.toFixed(1)} kg body-weight entry`
      : type === "nutrition"
        ? `${record.name} food entry`
      : `workout "${record.name}"`;
  if (!window.confirm(`Remove this ${label}?`)) return;

  const nextState = {
    ...state,
    [collection]: state[collection].filter((entry) => entry.id !== id),
  };
  const entryType = type === "water"
    ? "Water entry"
    : type === "weight"
      ? "Body-weight entry"
      : type === "nutrition"
        ? "Food entry"
        : "Workout";
  persist(nextState, `${entryType} removed.`);
}

function handleWaterSubmit(event) {
  event.preventDefault();
  if (!waterForm.reportValidity()) return;
  const amountMl = Number(new FormData(waterForm).get("amount"));
  const record = { id: createId(), amountMl, createdAt: new Date().toISOString() };

  if (!persist({ ...state, waterEntries: [record, ...state.waterEntries] }, "Water entry saved on this device.")) return;
  waterDialog.close();
}

function handleGoalsSubmit(event) {
  event.preventDefault();
  if (!goalsForm.reportValidity()) return;
  const formData = new FormData(goalsForm);
  const goals = {
    activityMinutes: Number(formData.get("activity")),
    waterMl: Number(formData.get("water")),
  };

  if (!persist({ ...state, goals }, "Daily goals updated.")) return;
  goalsDialog.close();
}

function handleWeightSubmit(event) {
  event.preventDefault();
  if (!weightForm.reportValidity()) return;

  const formData = new FormData(weightForm);
  const date = String(formData.get("date"));
  const weightKg = Number(formData.get("weight"));
  if (date > localDateKey(new Date())) {
    showError("Choose today or an earlier date for a body-weight check-in.");
    weightDateInput.focus();
    return;
  }
  if (state.weightEntries.some((entry) => entry.date === date)) {
    showError("A body-weight check-in already exists for that date. Remove it before adding another.");
    weightDateInput.focus();
    return;
  }

  const entry = { id: createId(), date, weightKg };
  if (persist({ ...state, weightEntries: [entry, ...state.weightEntries] }, "Body-weight check-in saved on this device.")) {
    weightForm.reset();
    weightDateInput.value = localDateKey(new Date());
    weightInput.focus();
  }
}

function handleNutritionSubmit(event) {
  event.preventDefault();
  if (!nutritionForm.reportValidity() || !nutritionDateInput.reportValidity()) return;

  const formData = new FormData(nutritionForm);
  const name = String(formData.get("name")).trim();
  const date = nutritionDateInput.value;
  if (!name) {
    showError("Enter a food or meal name.");
    nutritionForm.elements.name.focus();
    return;
  }
  if (date > localDateKey(new Date())) {
    showError("Choose today or an earlier date for a food entry.");
    nutritionDateInput.focus();
    return;
  }

  const entry = {
    id: createId(),
    name,
    date,
    calories: Number(formData.get("calories")),
    proteinG: Number(formData.get("protein")),
    carbsG: Number(formData.get("carbs")),
    fatG: Number(formData.get("fat")),
    createdAt: new Date().toISOString(),
  };
  if (persist({ ...state, nutritionEntries: [entry, ...state.nutritionEntries] }, "Food entry saved on this device.")) {
    nutritionForm.reset();
  }
}

function handleNutritionGoalsSubmit(event) {
  event.preventDefault();
  if (!nutritionGoalsForm.reportValidity()) return;
  const formData = new FormData(nutritionGoalsForm);
  const nutritionGoals = {
    calories: Number(formData.get("calories")),
    proteinG: Number(formData.get("protein")),
    carbsG: Number(formData.get("carbs")),
    fatG: Number(formData.get("fat")),
  };
  persist({ ...state, nutritionGoals }, "Daily nutrition goals updated.");
}

menuToggle.addEventListener("click", () => {
  setNavigationOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

backdrop.addEventListener("click", () => setNavigationOpen(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
    setNavigationOpen(false);
    menuToggle.focus();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const openWaterButton = target?.closest("[data-open-water]");
  const openGoalsButton = target?.closest("[data-open-goals]");
  const closeDialogButton = target?.closest("[data-close-dialog]");
  const removeButton = target?.closest("[data-remove-type]");
  const finishButton = target?.closest("[data-finish-workout]");
  const cancelButton = target?.closest("[data-cancel-workout]");
  const addSetButton = target?.closest("[data-add-set]");
  const removeSetButton = target?.closest("[data-remove-set]");
  const removeExerciseButton = target?.closest("[data-remove-exercise]");
  const startPlanButton = target?.closest("[data-start-plan]");
  const removePlanButton = target?.closest("[data-remove-plan]");
  const addPlanExerciseButton = target?.closest("[data-add-plan-exercise]");
  const removePlanExerciseButton = target?.closest("[data-remove-plan-exercise]");
  const timerToggleButton = target?.closest("[data-timer-toggle]");
  const timerResetButton = target?.closest("[data-timer-reset]");
  const exerciseDetailsButton = target?.closest("[data-exercise-details]");
  const addLibraryExerciseButton = target?.closest("[data-add-library-exercise]");
  const clearExerciseFiltersButton = target?.closest("#clear-exercise-filters");

  if (openWaterButton) openDialog(waterDialog);
  if (openGoalsButton) openDialog(goalsDialog);
  if (closeDialogButton) closeDialogButton.closest("dialog").close();
  if (removeButton) removeRecord(removeButton.dataset.removeType, removeButton.dataset.removeId);
  if (finishButton) finishWorkout();
  if (cancelButton) cancelWorkout();
  if (addSetButton) addSet(addSetButton.dataset.addSet);
  if (removeSetButton) removeSet(removeSetButton.dataset.exerciseId, removeSetButton.dataset.setId);
  if (removeExerciseButton) removeExercise(removeExerciseButton.dataset.removeExercise);
  if (startPlanButton) startPlan(startPlanButton.dataset.startPlan);
  if (removePlanButton) removePlan(removePlanButton.dataset.removePlan);
  if (addPlanExerciseButton) addPlanExerciseInput();
  if (removePlanExerciseButton) {
    const rows = [...planExerciseFields.querySelectorAll("[data-plan-exercise]")];
    if (rows.length <= 1) {
      showError("A training plan needs at least one exercise.");
    } else {
      removePlanExerciseButton.closest("[data-plan-exercise]").remove();
      updatePlanExerciseControls();
    }
  }
  if (timerToggleButton) toggleRestTimer();
  if (timerResetButton) stopRestTimer();
  if (exerciseDetailsButton) renderExerciseDetails(exerciseDetailsButton.dataset.exerciseDetails);
  if (addLibraryExerciseButton) addLibraryExerciseToWorkout();
  if (clearExerciseFiltersButton) {
    exerciseSearch.value = "";
    exerciseMuscleFilter.value = "";
    exerciseEquipmentFilter.value = "";
    renderExerciseLibrary();
    exerciseSearch.focus();
  }
});

document.addEventListener("change", handleSetChange);
exerciseMuscleFilter.addEventListener("change", renderExerciseLibrary);
exerciseEquipmentFilter.addEventListener("change", renderExerciseLibrary);
exerciseSearch.addEventListener("input", renderExerciseLibrary);
weightRangeSelect.addEventListener("change", renderBodyWeightChart);
strengthExerciseSelect.addEventListener("change", () => renderStrengthChart(collectStrengthHistory()));
document.querySelector("#workout-plan").addEventListener("change", (event) => {
  const selectedPlan = state.plans.find((plan) => plan.id === event.currentTarget.value);
  if (selectedPlan) document.querySelector("#workout-name").value = selectedPlan.name;
});

workoutForm.addEventListener("submit", handleWorkoutSubmit);
addExerciseForm.addEventListener("submit", handleAddExercise);
planForm.addEventListener("submit", handlePlanSubmit);
waterForm.addEventListener("submit", handleWaterSubmit);
goalsForm.addEventListener("submit", handleGoalsSubmit);
weightForm.addEventListener("submit", handleWeightSubmit);
nutritionForm.addEventListener("submit", handleNutritionSubmit);
nutritionGoalsForm.addEventListener("submit", handleNutritionGoalsSubmit);
nutritionDateInput.addEventListener("change", () => {
  if (!nutritionDateInput.validity.valid) {
    showError("Choose today or an earlier date.");
    nutritionDateInput.value = localDateKey(new Date());
  } else {
    appStatus.hidden = true;
  }
  renderNutrition();
});
accountSyncButton.addEventListener("click", syncAccountData);
accountSignOutButton.addEventListener("click", async () => {
  accountSignOutButton.disabled = true;
  try {
    await signOut();
    currentUser = null;
    cloudSyncEnabled = false;
    accountNotice = "Signed out. Your saved data remains on this device.";
    renderAccount();
  } catch (error) {
    accountNotice = `Could not sign out. ${error.message}`;
    renderAccount();
    showError(accountNotice);
  } finally {
    accountSignOutButton.disabled = false;
  }
});
accountDeleteButton.addEventListener("click", () => {
  if (!currentUser) return;

  deleteAccountForm.reset();
  deleteAccountDialog.showModal();
  deleteAccountPassword.focus();
});

cancelAccountDeletion.addEventListener("click", () => {
  if (accountDeletionInProgress) return;

  deleteAccountForm.reset();
  deleteAccountDialog.close();
});
deleteAccountDialog.addEventListener("cancel", (event) => {
  if (accountDeletionInProgress) {
    event.preventDefault();
  }
});
deleteAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (accountDeletionInProgress || !currentUser) return;

  const password = deleteAccountPassword.value;

  if (!password) {
    deleteAccountPassword.setCustomValidity("Password is required.");
    deleteAccountPassword.reportValidity();
    deleteAccountPassword.setCustomValidity("");
    return;
  }
const wasCloudSyncEnabled = cloudSyncEnabled;
  accountDeletionInProgress = true;
cloudSyncEnabled = false;

cancelAccountDeletion.disabled = true;
deleteAccountPassword.disabled = true;

accountNotice = "Preparing secure account deletion...";
renderAccount();

try {
  await waitForPendingCloudSaves();

const deletedUserId = currentUser.id;

await deleteCurrentAccount(password);
// Clear the deleted account's saved login session.
try {
  await signOut();
} catch (signOutError) {
  console.warn("Could not clear the local session:", signOutError);
}
// Server confirmed that the account was deleted.
cloudSyncEnabled = false;
currentUser = null;

try {
  clearDeletedAccountLocalData(deletedUserId);
} catch (cleanupError) {
  console.error("Local account data cleanup failed:", cleanupError);
  accountNotice =
    "Your account was deleted, but local data could not be cleared. Please clear this site's browser storage.";
}

if (!accountNotice.includes("local data could not be cleared")) {
  accountNotice = "Your FITTRACK account was deleted successfully.";
}

deleteAccountForm.reset();
deleteAccountDialog.close();
render();
} catch (error) {
  if (currentUser) {
    cloudSyncEnabled = wasCloudSyncEnabled;
  }

  accountNotice = `Account deletion failed. ${error.message}`;
  showError(accountNotice);
} finally {  accountDeletionInProgress = false;
  cancelAccountDeletion.disabled = false;
  deleteAccountPassword.disabled = false;
  renderAccount();
}
});
restDurationSelect.addEventListener("change", () => {
  stopRestTimer();
});

window.addEventListener("hashchange", () => {
  const nextView = window.location.hash.slice(1);
  if (nextView !== "workouts") pendingExercise = null;
  showView(nextView);
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 760) setNavigationOpen(false);
});

document.querySelector("#water-amount").addEventListener("input", (event) => {
  if (event.currentTarget.validity.valid) appStatus.hidden = true;
});

populateExerciseFilters();
render();
updatePlanExerciseControls();
currentDayKey = localDateKey(new Date());
showView(window.location.hash.slice(1) || "dashboard");
initializeAccount();

window.setInterval(updateElapsedTime, 1000);
window.setInterval(() => {
  updateDate();
  const nextDayKey = localDateKey(new Date());
  if (nextDayKey !== currentDayKey) {
    currentDayKey = nextDayKey;
    render();
  }
}, 60000);

window.addEventListener("storage", (event) => {
  if (event.key !== "fittrack.guest.v1" && event.key !== null) return;
  try {
    state = loadGuestData();
    storageError = null;
    appStatus.hidden = true;
    render();
    if (currentUser && cloudSyncEnabled) queueCloudSave(state, currentUser.id);
  } catch (error) {
    storageError = error;
    setStorageUnavailable();
  }
});
