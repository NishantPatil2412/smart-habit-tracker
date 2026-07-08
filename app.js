/**
 * Smart Habit Tracker 2024
 * Pure HTML/CSS/JS — no npm or build step required.
 * Data persists in localStorage + optional JSON file (export/import / linked file).
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'smart-habit-tracker-2024';
  const STORAGE_VERSION = '7';
  const DATA_FILE = 'data/habits.json';
  const COLORS = ['#e8a317', '#3b9fd9', '#8b7355', '#4caf50', '#e040a0', '#9b59b6', '#e74c3c', '#1abc9c'];
  const CATEGORIES = {
    health: { label: 'Health', emoji: '💪' },
    mind: { label: 'Mind', emoji: '🧠' },
    work: { label: 'Work', emoji: '💼' },
    personal: { label: 'Personal', emoji: '✨' },
    other: { label: 'Other', emoji: '📌' },
  };
  const TEMPLATES = [
    { name: 'Morning meditation', emoji: '🧘', category: 'mind', frequency: 'daily', targetCount: 1, color: '#3b9fd9' },
    { name: 'Drink water', emoji: '💧', category: 'health', frequency: 'daily', targetCount: 8, color: '#1abc9c', trackLiters: true, literTarget: 2, startTime: '08:00', endTime: '12:00' },
    { name: 'Exercise', emoji: '🏋️', category: 'health', frequency: 'daily', targetCount: 1, color: '#9b59b6' },
    { name: 'Read 30 min', emoji: '📖', category: 'mind', frequency: 'daily', targetCount: 1, color: '#4caf50' },
    { name: 'Deep work', emoji: '💻', category: 'work', frequency: 'weekly', targetCount: 5, color: '#8b7355' },
    { name: 'Walk', emoji: '🚶', category: 'health', frequency: 'daily', targetCount: 1, color: '#1abc9c', trackSteps: true, stepTarget: 10000, startTime: '07:00', endTime: '07:45' },
  ];
  const ACHIEVEMENTS = [
    { id: 'first', icon: '🌱', title: 'First Step', desc: 'Log your first habit' },
    { id: 'streak3', icon: '🔥', title: 'On Fire', desc: 'Reach a 3-day streak' },
    { id: 'streak7', icon: '⚡', title: 'Unstoppable', desc: 'Reach a 7-day streak' },
    { id: 'all_today', icon: '🎯', title: 'Perfect Day', desc: 'Complete all habits today' },
    { id: 'xp100', icon: '⭐', title: 'Rising Star', desc: 'Earn 100 XP' },
    { id: 'week10', icon: '📅', title: 'Week Warrior', desc: '10 completions in one week' },
  ];
  const QUOTES = [
    'Small steps every day lead to big changes.',
    'You don\'t have to be perfect, just consistent.',
    'Today is a great day to build better habits.',
    'Progress, not perfection.',
    'Your future self will thank you.',
  ];
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_LABELS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const USER_AVATARS = ['👤', '👩', '👨', '🧑', '🧑‍💻', '🏃', '🌟', '🎯'];

  let app = {
    currentUserId: null,
    users: {},
    fileHandle: null,
  };

  let state = {
    habits: [],
    settings: { darkMode: false, celebrate: true, showArchived: false },
    gamification: { xp: 0, unlocked: [] },
    ui: { weekOffset: 0, filter: 'all', search: '', sort: 'pinned', trackerDayOffset: 0 },
    undoStack: [],
  };

  let editingId = null;
  let editingUserId = null;

  // ─── Date helpers ───────────────────────────────────────────────

  function toDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parseDateKey(key) {
    const p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function startOfWeek(d) {
    const r = new Date(d);
    const day = r.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    r.setDate(r.getDate() + diff);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  function formatDisplayDate(key) {
    return parseDateKey(key).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  function getWeekKey(d) {
    return toDateKey(startOfWeek(d));
  }

  function getMonthKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function completionDateKey(c) {
    if (typeof c === 'string') return c;
    if (c && c.date) return c.date;
    return '';
  }

  function countOnDate(completions, d) {
    const k = toDateKey(d);
    return completions.filter(function (c) { return completionDateKey(c) === k; }).length;
  }

  function countInWeek(completions, d) {
    const ws = startOfWeek(d);
    const we = addDays(ws, 6);
    return completions.filter(function (c) {
      const dd = parseDateKey(completionDateKey(c));
      return dd >= ws && dd <= we;
    }).length;
  }

  function countInMonth(completions, d) {
    const m = d.getMonth();
    const y = d.getFullYear();
    return completions.filter(function (c) {
      const dd = parseDateKey(completionDateKey(c));
      return dd.getMonth() === m && dd.getFullYear() === y;
    }).length;
  }

  function countInQuarter(completions, year, quarter) {
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;
    return completions.filter(function (c) {
      const dd = parseDateKey(completionDateKey(c));
      return dd.getFullYear() === year && dd.getMonth() >= startMonth && dd.getMonth() <= endMonth;
    }).length;
  }

  function countInYear(completions, year) {
    return completions.filter(function (c) {
      return parseDateKey(completionDateKey(c)).getFullYear() === year;
    }).length;
  }

  function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    if (typeof timeStr !== 'string') timeStr = String(timeStr);
    timeStr = timeStr.trim();
    var match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  function normalizeTimeValue(val) {
    if (!val) return '';
    if (typeof val !== 'string') val = String(val);
    val = val.trim();
    var match = val.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return '';
    var h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
    return String(h).padStart(2, '0') + ':' + match[2];
  }

  function minutesToTimeString(mins) {
    mins = Math.max(0, Math.min(24 * 60 - 1, mins));
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function resolveScheduleTimes(h) {
    var startTime = normalizeTimeValue(h.startTime);
    var endTime = normalizeTimeValue(h.endTime);
    var startM = parseTimeToMinutes(startTime);
    if (startM === null) return null;
    var endM = parseTimeToMinutes(endTime);
    if (endM === null || endM <= startM) {
      endM = startM + 60;
      endTime = minutesToTimeString(endM);
    }
    return { startM: startM, endM: endM, startTime: startTime, endTime: endTime };
  }

  function formatTime12(timeStr) {
    if (!timeStr) return '';
    var mins = parseTimeToMinutes(timeStr);
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  function formatTimeRange(startTime, endTime) {
    if (!startTime && !endTime) return '';
    if (startTime && endTime) return formatTime12(startTime) + ' – ' + formatTime12(endTime);
    return formatTime12(startTime || endTime);
  }

  function getStepsForDate(h, dateKey) {
    if (!h.stepLogs) return 0;
    return h.stepLogs[dateKey] || 0;
  }

  function isWalkHabit(h) {
    return !!h.trackSteps;
  }

  function isWaterHabit(h) {
    return !!h.trackLiters;
  }

  function getLitersForDate(h, dateKey) {
    if (!h.literLogs) return 0;
    return h.literLogs[dateKey] || 0;
  }

  function formatLiters(n) {
    return (Math.round(n * 10) / 10).toFixed(1) + ' L';
  }

  function getMetricLabel(h, dateKey) {
    if (isWalkHabit(h)) {
      return getStepsForDate(h, dateKey).toLocaleString() + ' / ' + h.stepTarget.toLocaleString() + ' steps';
    }
    if (isWaterHabit(h)) {
      return formatLiters(getLitersForDate(h, dateKey)) + ' / ' + formatLiters(h.literTarget);
    }
    return '';
  }

  // ─── Habit logic ────────────────────────────────────────────────

  function freqLabel(h) {
    return h.frequency.charAt(0).toUpperCase() + h.frequency.slice(1) + ': ' + h.targetCount + 'x';
  }

  function periodProgress(h, today) {
    today = today || new Date();
    var current = 0;
    var label = 'Daily';
    if (h.frequency === 'daily') {
      current = countOnDate(h.completions, today);
      label = 'Daily';
    } else if (h.frequency === 'weekly') {
      current = countInWeek(h.completions, today);
      label = 'Weekly';
    } else {
      current = countInMonth(h.completions, today);
      label = 'Monthly';
    }
    var target = h.targetCount;
    var percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { current: current, target: target, percent: percent, label: label };
  }

  function periodMet(h, d) {
    if (h.frequency === 'daily') return countOnDate(h.completions, d) >= h.targetCount;
    if (h.frequency === 'weekly') return countInWeek(h.completions, d) >= h.targetCount;
    return countInMonth(h.completions, d) >= h.targetCount;
  }

  function prevPeriod(d, freq) {
    if (freq === 'daily') return addDays(d, -1);
    if (freq === 'weekly') return addDays(d, -7);
    var r = new Date(d);
    r.setMonth(r.getMonth() - 1);
    return r;
  }

  function getStreak(h, today) {
    today = today || new Date();
    var unit = h.frequency === 'daily' ? 'day' : h.frequency === 'weekly' ? 'week' : 'month';
    var current = 0;
    var cursor = new Date(today);

    if (periodMet(h, cursor)) {
      current = 1;
      cursor = prevPeriod(cursor, h.frequency);
      while (periodMet(h, cursor)) {
        current++;
        cursor = prevPeriod(cursor, h.frequency);
      }
    }

    var max = 0, run = 0;
    var start = parseDateKey(h.startDate);
    var d = new Date(start);
    var days = [];
    while (d <= today) {
      days.push(toDateKey(d));
      d.setDate(d.getDate() + 1);
    }

    if (h.frequency === 'daily') {
      for (var i = 0; i < days.length; i++) {
        if (countOnDate(h.completions, parseDateKey(days[i])) >= h.targetCount) {
          run++; max = Math.max(max, run);
        } else run = 0;
      }
    } else if (h.frequency === 'weekly') {
      var weeks = {};
      days.forEach(function (day) { weeks[getWeekKey(parseDateKey(day))] = true; });
      Object.keys(weeks).sort().forEach(function (wk) {
        if (countInWeek(h.completions, parseDateKey(wk)) >= h.targetCount) {
          run++; max = Math.max(max, run);
        } else run = 0;
      });
    } else {
      var months = {};
      days.forEach(function (day) { months[getMonthKey(parseDateKey(day))] = true; });
      Object.keys(months).sort().forEach(function (mk) {
        var p = mk.split('-').map(Number);
        if (countInMonth(h.completions, new Date(p[0], p[1] - 1, 15)) >= h.targetCount) {
          run++; max = Math.max(max, run);
        } else run = 0;
      });
    }

    return { current: current, max: max, unit: unit, isNewRecord: current > 0 && current >= max && current > 1 };
  }

  function isDoneToday(h) {
    var today = new Date();
    if (h.frequency === 'daily') return countOnDate(h.completions, today) >= h.targetCount;
    return countOnDate(h.completions, today) > 0;
  }

  function uid() {
    return 'h-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  // ─── Seed data ──────────────────────────────────────────────────

  function getSeedHabits() {
    var todayKey = toDateKey(new Date());
    var base = {
      startDate: todayKey, completions: [], description: '', reminderTime: '',
      startTime: '', endTime: '', trackSteps: false, stepTarget: 10000, stepLogs: {},
      trackLiters: false, literTarget: 2, literLogs: {},
      archived: false, pinned: false,
    };
    return [
      Object.assign({ id: '1', name: 'Learn French', emoji: '👄', color: '#e8a317', frequency: 'daily', targetCount: 2, category: 'mind', startTime: '08:00', endTime: '08:30' }, base),
      Object.assign({ id: '2', name: 'Meditation', emoji: '🧘', color: '#3b9fd9', frequency: 'daily', targetCount: 1, category: 'mind', startTime: '06:30', endTime: '07:00' }, base),
      Object.assign({ id: '3', name: 'Programming', emoji: '💻', color: '#8b7355', frequency: 'weekly', targetCount: 3, category: 'work', startTime: '10:00', endTime: '12:00' }, base),
      Object.assign({ id: '4', name: 'Read a book', emoji: '📖', color: '#4caf50', frequency: 'weekly', targetCount: 1, category: 'mind', startTime: '20:00', endTime: '20:30' }, base),
      Object.assign({ id: '5', name: 'Side Hustle', emoji: '💼', color: '#e040a0', frequency: 'monthly', targetCount: 10, category: 'work', startTime: '18:00', endTime: '19:00' }, base),
      Object.assign({ id: '6', name: 'Workout', emoji: '🏋️', color: '#9b59b6', frequency: 'daily', targetCount: 1, category: 'health', startTime: '17:00', endTime: '18:00' }, base),
      Object.assign({ id: '7', name: 'Walk', emoji: '🚶', color: '#1abc9c', frequency: 'daily', targetCount: 1, category: 'health', startTime: '07:00', endTime: '07:45', trackSteps: true, stepTarget: 10000 }, base),
    ];
  }

  function clearAllCompletions() {
    state.habits.forEach(function (h) { h.completions = []; });
  }

  // ─── Multi-user profiles ────────────────────────────────────────

  function createEmptyUser(name, avatar) {
    return {
      id: uid(),
      name: name || 'User',
      avatar: avatar || '👤',
      createdAt: new Date().toISOString(),
      habits: [],
      settings: { darkMode: false, celebrate: true, showArchived: false },
      gamification: { xp: 0, unlocked: [] },
    };
  }

  function getCurrentUser() {
    return app.users[app.currentUserId] || null;
  }

  function syncStateToCurrentUser() {
    var user = getCurrentUser();
    if (!user) return;
    user.habits = state.habits;
    user.settings = Object.assign({}, state.settings);
    user.gamification = Object.assign({ xp: 0, unlocked: [] }, state.gamification);
  }

  function loadUserIntoState(user) {
    state.habits = user.habits || [];
    state.settings = Object.assign({ darkMode: false, celebrate: true, showArchived: false }, user.settings);
    state.gamification = Object.assign({ xp: 0, unlocked: [] }, user.gamification);
    state.ui = { weekOffset: 0, filter: 'all', search: '', sort: 'pinned', trackerDayOffset: 0 };
    state.undoStack = [];
    var undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.disabled = true;
    migrateState();
  }

  function loadCurrentUser() {
    var user = getCurrentUser();
    if (!user) return;
    loadUserIntoState(user);
    applyTheme();
  }

  function ensureDefaultUser() {
    if (Object.keys(app.users).length > 0) return;
    var u = createEmptyUser('Me', '👤');
    u.habits = getSeedHabits();
    app.users[u.id] = u;
    app.currentUserId = u.id;
  }

  function parseAppData(data) {
    if (!data) return false;
    if (data.users && typeof data.users === 'object') {
      app.users = data.users;
      app.currentUserId = data.currentUserId;
      var ids = Object.keys(app.users);
      if (!app.currentUserId || !app.users[app.currentUserId]) {
        app.currentUserId = ids[0] || null;
      }
      return ids.length > 0;
    }
    if (Array.isArray(data.habits)) {
      var legacy = createEmptyUser('Me', '👤');
      legacy.habits = data.habits;
      if (data.settings) legacy.settings = Object.assign(legacy.settings, data.settings);
      if (data.gamification) legacy.gamification = Object.assign(legacy.gamification, data.gamification);
      app.users = {};
      app.users[legacy.id] = legacy;
      app.currentUserId = legacy.id;
      return true;
    }
    return false;
  }

  function switchUser(userId) {
    if (!app.users[userId] || userId === app.currentUserId) return;
    syncStateToCurrentUser();
    app.currentUserId = userId;
    loadCurrentUser();
    save();
    renderUserSwitcher();
    renderAll();
    var u = getCurrentUser();
    showToast('Switched to ' + u.avatar + ' ' + u.name, 'info');
  }

  function createUser(name, avatar) {
    name = (name || '').trim();
    if (!name) return false;
    syncStateToCurrentUser();
    var u = createEmptyUser(name, avatar || '👤');
    app.users[u.id] = u;
    app.currentUserId = u.id;
    loadCurrentUser();
    save();
    renderUserSwitcher();
    renderAll();
    showToast('Profile created: ' + u.avatar + ' ' + u.name, 'success');
    return true;
  }

  function deleteUser(userId) {
    var ids = Object.keys(app.users);
    if (ids.length <= 1) {
      showToast('Cannot delete the only profile', 'info');
      return;
    }
    var user = app.users[userId];
    if (!user) return;
    if (!confirm('Delete "' + user.name + '" and all their habits & records?')) return;
    syncStateToCurrentUser();
    delete app.users[userId];
    if (app.currentUserId === userId) {
      app.currentUserId = Object.keys(app.users)[0];
      loadCurrentUser();
    }
    save();
    renderUserSwitcher();
    renderUserList();
    renderAll();
    showToast('Profile deleted', 'info');
  }

  function updateUser(userId, name, avatar) {
    var user = app.users[userId];
    if (!user) return;
    user.name = (name || user.name).trim();
    if (avatar) user.avatar = avatar;
    save();
    renderUserSwitcher();
    renderUserList();
    renderAll();
  }

  function serializeApp() {
    syncStateToCurrentUser();
    return JSON.stringify({
      version: STORAGE_VERSION,
      currentUserId: app.currentUserId,
      users: app.users,
      savedAt: new Date().toISOString(),
    }, null, 2);
  }

  function serializeUserExport() {
    syncStateToCurrentUser();
    var user = getCurrentUser();
    if (!user) return '{}';
    return JSON.stringify({
      userName: user.name,
      habits: user.habits,
      settings: user.settings,
      gamification: user.gamification,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  // ─── Persistence ────────────────────────────────────────────────

  function migrateHabit(h) {
    h.category = h.category || 'other';
    h.description = h.description || '';
    h.reminderTime = h.reminderTime || '';
    h.startTime = h.startTime || '';
    h.endTime = h.endTime || '';
    h.trackSteps = !!h.trackSteps;
    h.stepTarget = h.stepTarget || 10000;
    h.stepLogs = h.stepLogs || {};
    h.trackLiters = !!h.trackLiters;
    h.literTarget = h.literTarget || 2;
    h.literLogs = h.literLogs || {};
    h.startTime = normalizeTimeValue(h.startTime);
    h.endTime = normalizeTimeValue(h.endTime);
    h.archived = !!h.archived;
    h.pinned = !!h.pinned;
    if (!Array.isArray(h.completions)) h.completions = [];
    return h;
  }

  function migrateState() {
    state.habits = state.habits.map(migrateHabit);
    state.settings = Object.assign({ darkMode: false, celebrate: true, showArchived: false }, state.settings || {});
    state.gamification = Object.assign({ xp: 0, unlocked: [] }, state.gamification || {});
    state.ui = Object.assign({ weekOffset: 0, filter: 'all', search: '', sort: 'pinned', trackerDayOffset: 0 }, state.ui || {});
    if (!state.undoStack) state.undoStack = [];
    recalcXP();
  }

  function recalcXP() {
    var xp = 0;
    state.habits.forEach(function (h) { xp += h.completions.length * 10; });
    state.gamification.xp = xp;
  }

  function getLevel() {
    return Math.floor(state.gamification.xp / 100) + 1;
  }

  function serialize() {
    return serializeUserExport();
  }

  function applyData(data) {
    if (parseAppData(data)) {
      loadCurrentUser();
      return;
    }
    if (data && Array.isArray(data.habits)) {
      var user = getCurrentUser();
      if (user) {
        user.habits = data.habits;
        if (data.settings) user.settings = Object.assign(user.settings, data.settings);
        if (data.gamification) user.gamification = Object.assign({ xp: 0, unlocked: [] }, data.gamification);
        loadUserIntoState(user);
        migrateState();
      }
    }
  }

  function save() {
    try {
      syncStateToCurrentUser();
      localStorage.setItem(STORAGE_KEY, serializeApp());
      localStorage.setItem(STORAGE_KEY + '-version', STORAGE_VERSION);
      var u = getCurrentUser();
      updateDataStatus('Saved · ' + (u ? u.name : 'local'));
    } catch (e) {
      updateDataStatus('Save failed: ' + e.message);
    }
    writeLinkedFile();
  }

  function writeLinkedFile() {
    if (!app.fileHandle) return;
    app.fileHandle.createWritable().then(function (writable) {
      return writable.write(serializeApp()).then(function () { return writable.close(); });
    }).then(function () {
      updateDataStatus('Saved to linked file + browser storage');
    }).catch(function () {
      app.fileHandle = null;
      updateDataStatus('Linked file lost — use Export or re-link');
    });
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!parseAppData(data)) return false;
      ensureDefaultUser();
      loadCurrentUser();
      return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function loadFromDataFile(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', DATA_FILE, true);
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (xhr.status === 200 || xhr.status === 0) {
        try {
          if (parseAppData(JSON.parse(xhr.responseText))) {
            callback(true);
            return;
          }
        } catch (e) { /* ignore */ }
      }
      callback(false);
    };
    xhr.onerror = function () { callback(false); };
    xhr.ontimeout = function () { callback(false); };
    xhr.send();
  }

  function exportDataFile() {
    var blob = new Blob([serializeApp()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'habit-tracker-all-users.json';
    a.click();
    URL.revokeObjectURL(a.href);
    updateDataStatus('Exported all profiles');
  }

  function exportCurrentUser() {
    var user = getCurrentUser();
    var blob = new Blob([serializeUserExport()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'habits-' + (user ? user.name.replace(/\s+/g, '-').toLowerCase() : 'user') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Exported ' + (user ? user.name : 'profile'), 'success');
  }

  function importDataFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data.users) {
          parseAppData(data);
          ensureDefaultUser();
          loadCurrentUser();
        } else {
          applyData(data);
        }
        save();
        renderUserSwitcher();
        renderAll();
        updateDataStatus('Imported from ' + file.name);
        showToast('Data imported successfully', 'success');
      } catch (e) {
        alert('Invalid JSON file: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  async function linkDataFile() {
    if (!window.showOpenFilePicker) {
      document.getElementById('input-import').click();
      return;
    }
    try {
      var handles = await window.showOpenFilePicker({
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        multiple: false,
      });
      app.fileHandle = handles[0];
      var file = await app.fileHandle.getFile();
      var data = JSON.parse(await file.text());
      if (data.users) {
        parseAppData(data);
        ensureDefaultUser();
        loadCurrentUser();
      } else {
        applyData(data);
      }
      save();
      renderUserSwitcher();
      renderAll();
      updateDataStatus('Linked to ' + file.name + ' — auto-saves on change');
    } catch (e) {
      if (e.name !== 'AbortError') alert(e.message);
    }
  }

  function updateDataStatus(msg) {
    var el = document.getElementById('data-status');
    if (el) el.textContent = msg;
  }

  function initData() {
    var hadStorage = loadFromStorage();
    if (!hadStorage) {
      ensureDefaultUser();
      loadCurrentUser();
    }
    applyTheme();
    renderCriticalUI();
    markAppLoaded();

    if (hadStorage) {
      updateDataStatus('Loaded from browser storage');
      scheduleDeferredRender();
      return;
    }

    updateDataStatus('Loading…');
    scheduleDeferredRender();
    loadFromDataFile(function (ok) {
      if (ok) {
        ensureDefaultUser();
        loadCurrentUser();
        save();
        updateDataStatus('Loaded from ' + DATA_FILE);
      } else {
        save();
        updateDataStatus('Created default profile');
      }
      renderAll();
    });
  }

  function syncSettingsForm() {
    var settingDark = document.getElementById('setting-dark');
    if (!settingDark) return;
    settingDark.checked = state.settings.darkMode;
    document.getElementById('setting-celebrate').checked = state.settings.celebrate;
    document.getElementById('setting-archived').checked = state.settings.showArchived;
    document.getElementById('btn-undo').disabled = state.undoStack.length === 0;
  }

  function renderActiveSecondaryPanel() {
    var activeTab = document.querySelector('.tab.active');
    if (!activeTab) return;
    var tabId = activeTab.getAttribute('data-tab');
    if (tabId === 'today') renderTodayPanel();
    else if (tabId === 'monthly') renderMonthlyPanel();
    else if (tabId === 'quarterly') renderQuarterlyPanel();
    else if (tabId === 'yearly') renderYearlyPanel();
    else if (tabId === 'stats') renderStatsPanel();
    else if (tabId === 'more') renderMorePanel();
  }

  function renderCriticalUI() {
    updateLevelBadge();
    renderUserSwitcher();
    renderDashboard();
    renderHabitsToolbar();
    renderSidebarStats();
    renderAchievements();
    renderHabitsPanel();
    syncSettingsForm();
  }

  function scheduleDeferredRender() {
    requestAnimationFrame(function () {
      renderSidebar();
    });
  }

  function markAppLoaded() {
    document.documentElement.classList.add('app-loaded');
  }

  // ─── Gamification, toast, undo ──────────────────────────────────

  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  }

  function unlockAchievement(id) {
    if (state.gamification.unlocked.indexOf(id) >= 0) return;
    state.gamification.unlocked.push(id);
    var ach = ACHIEVEMENTS.find(function (a) { return a.id === id; });
    if (ach) showToast(ach.icon + ' Achievement: ' + ach.title + '!', 'success');
    renderAchievements();
  }

  function checkAchievements() {
    var total = 0;
    state.habits.forEach(function (h) { total += h.completions.length; });
    if (total >= 1) unlockAchievement('first');
    if (state.gamification.xp >= 100) unlockAchievement('xp100');

    var active = state.habits.filter(function (h) { return !h.archived; });
    if (active.length > 0 && active.every(isDoneToday)) unlockAchievement('all_today');

    state.habits.forEach(function (h) {
      var s = getStreak(h);
      if (s.unit === 'day' && s.max >= 3) unlockAchievement('streak3');
      if (s.unit === 'day' && s.max >= 7) unlockAchievement('streak7');
      if (countInWeek(h.completions, new Date()) >= 10) unlockAchievement('week10');
    });
  }

  function addXP(amount) {
    state.gamification.xp += amount;
    checkAchievements();
    updateLevelBadge();
  }

  function updateLevelBadge() {
    var el = document.getElementById('level-badge');
    if (el) el.textContent = 'Level ' + getLevel() + ' · ' + state.gamification.xp + ' XP';
  }

  function pushUndo(entry) {
    state.undoStack.push(entry);
    if (state.undoStack.length > 20) state.undoStack.shift();
    var btn = document.getElementById('btn-undo');
    if (btn) btn.disabled = false;
  }

  function undo() {
    var entry = state.undoStack.pop();
    if (!entry) return;
    var h = state.habits.find(function (x) { return x.id === entry.habitId; });
    if (!h) return;
    if (entry.action === 'add') {
      var idx = -1;
      for (var i = h.completions.length - 1; i >= 0; i--) {
        if (completionDateKey(h.completions[i]) === entry.dateKey) { idx = i; break; }
      }
      if (idx >= 0) h.completions.splice(idx, 1);
      state.gamification.xp = Math.max(0, state.gamification.xp - 10);
    } else if (entry.action === 'remove') {
      h.completions.push(entry.dateKey);
      state.gamification.xp += 10;
    }
    save();
    renderAll();
    showToast('Undid last action', 'info');
    if (state.undoStack.length === 0) document.getElementById('btn-undo').disabled = true;
  }

  function logCompletion(habitId, dateKey, source) {
    var h = state.habits.find(function (x) { return x.id === habitId; });
    if (!h || h.archived) return;
    var d = parseDateKey(dateKey);
    if (d > new Date()) return;
    h.completions.push(dateKey);
    pushUndo({ habitId: habitId, dateKey: dateKey, action: 'add' });
    addXP(10);
    save();
    if (state.settings.celebrate && isDoneToday(h)) {
      showToast(h.emoji + ' ' + h.name + ' done!', 'success');
    }
    checkAchievements();
    if (state.settings.celebrate) {
      var active = state.habits.filter(function (x) { return !x.archived; });
      if (active.length > 0 && active.every(isDoneToday)) {
        showToast('🎉 Perfect day! All habits complete!', 'celebrate');
      }
    }
    renderAll();
  }

  function removeOneCompletion(habitId, dateKey) {
    var h = state.habits.find(function (x) { return x.id === habitId; });
    if (!h) return;
    var idx = -1;
    for (var i = h.completions.length - 1; i >= 0; i--) {
      if (completionDateKey(h.completions[i]) === dateKey) { idx = i; break; }
    }
    if (idx < 0) return;
    h.completions.splice(idx, 1);
    pushUndo({ habitId: habitId, dateKey: dateKey, action: 'remove' });
    state.gamification.xp = Math.max(0, state.gamification.xp - 10);
    save();
    renderAll();
  }

  function logSteps(habitId, dateKey, steps) {
    var h = state.habits.find(function (x) { return x.id === habitId; });
    if (!h || !h.trackSteps) return;
    steps = Math.max(0, parseInt(steps, 10) || 0);
    if (!h.stepLogs) h.stepLogs = {};
    h.stepLogs[dateKey] = steps;
    if (steps >= h.stepTarget && countOnDate(h.completions, parseDateKey(dateKey)) < h.targetCount) {
      logCompletion(habitId, dateKey, 'steps');
      return;
    }
    save();
    renderAll();
    showToast('Steps logged: ' + steps.toLocaleString(), 'success');
  }

  function logLiters(habitId, dateKey, liters) {
    var h = state.habits.find(function (x) { return x.id === habitId; });
    if (!h || !h.trackLiters) return;
    liters = Math.max(0, parseFloat(liters) || 0);
    if (!h.literLogs) h.literLogs = {};
    h.literLogs[dateKey] = Math.round(liters * 10) / 10;
    if (h.literLogs[dateKey] >= h.literTarget && countOnDate(h.completions, parseDateKey(dateKey)) < h.targetCount) {
      logCompletion(habitId, dateKey, 'liters');
      return;
    }
    save();
    renderAll();
    showToast('Water logged: ' + formatLiters(h.literLogs[dateKey]), 'success');
  }

  function toggleStepFields() {
    var row = document.getElementById('step-target-row');
    var checked = document.getElementById('habit-track-steps').checked;
    if (row) row.style.display = checked ? 'flex' : 'none';
  }

  function toggleLiterFields() {
    var row = document.getElementById('liter-target-row');
    var checked = document.getElementById('habit-track-liters').checked;
    if (row) row.style.display = checked ? 'flex' : 'none';
  }

  function promptMetricLog(h, dateKey, dateLabel) {
    if (isWalkHabit(h)) {
      var steps = getStepsForDate(h, dateKey);
      var stepInput = prompt('Enter step count' + (dateLabel ? ' for ' + dateLabel : '') + ':', steps || '');
      if (stepInput !== null) logSteps(h.id, dateKey, stepInput);
      return;
    }
    if (isWaterHabit(h)) {
      var liters = getLitersForDate(h, dateKey);
      var literInput = prompt('Enter liters consumed' + (dateLabel ? ' for ' + dateLabel : '') + ':', liters || '');
      if (literInput !== null) logLiters(h.id, dateKey, literInput);
    }
  }

  function toggleDayCompletion(habitId, dateKey) {
    var h = state.habits.find(function (x) { return x.id === habitId; });
    if (!h) return;
    if (countOnDate(h.completions, parseDateKey(dateKey)) > 0) {
      removeOneCompletion(habitId, dateKey);
    } else {
      logCompletion(habitId, dateKey, 'toggle');
    }
  }

  function applyTheme() {
    document.body.classList.toggle('theme-dark', !!state.settings.darkMode);
  }

  function getGreeting() {
    var h = new Date().getHours();
    var base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    var user = getCurrentUser();
    return user ? base + ', ' + user.name.split(' ')[0] : base;
  }

  function renderUserSwitcher() {
    var el = document.getElementById('user-switcher');
    if (!el) return;
    var current = getCurrentUser();
    if (!current) { el.innerHTML = ''; return; }

    var others = Object.keys(app.users).filter(function (id) { return id !== app.currentUserId; });
    var quickSwitch = others.map(function (id) {
      var u = app.users[id];
      return '<button type="button" class="user-chip" data-user="' + id + '" title="Switch to ' + esc(u.name) + '">' +
        u.avatar + ' ' + esc(u.name) + '</button>';
    }).join('');

    el.innerHTML =
      '<div class="current-user">' +
        '<div class="current-user-avatar">' + current.avatar + '</div>' +
        '<div class="current-user-info">' +
          '<span class="current-user-name">' + esc(current.name) + '</span>' +
          '<span class="current-user-meta">Level ' + getLevel() + ' · ' + state.habits.length + ' habits</span>' +
        '</div>' +
        '<button type="button" class="btn btn-sm" id="btn-users" title="Manage profiles">⇄</button>' +
      '</div>' +
      (quickSwitch ? '<div class="user-quick-switch">' + quickSwitch + '</div>' : '');

    document.getElementById('btn-users').addEventListener('click', openUsersModal);
    el.querySelectorAll('.user-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        switchUser(chip.getAttribute('data-user'));
      });
    });
  }

  function renderUserList() {
    var el = document.getElementById('users-list');
    if (!el) return;
    var ids = Object.keys(app.users);
    el.innerHTML = ids.map(function (id) {
      var u = app.users[id];
      var isActive = id === app.currentUserId;
      var habitCount = (u.habits || []).length;
      var completions = 0;
      (u.habits || []).forEach(function (h) { completions += h.completions.length; });
      return '<div class="user-list-item' + (isActive ? ' active' : '') + '">' +
        '<div class="user-list-main">' +
          '<span class="user-list-avatar">' + u.avatar + '</span>' +
          '<div><strong>' + esc(u.name) + '</strong>' +
          (isActive ? ' <span class="active-tag">Active</span>' : '') +
          '<div class="user-list-meta">' + habitCount + ' habits · ' + completions + ' completions</div></div>' +
        '</div>' +
        '<div class="user-list-actions">' +
          (isActive ? '' : '<button type="button" class="btn btn-sm switch-user" data-id="' + id + '">Switch</button>') +
          '<button type="button" class="btn btn-sm edit-user" data-id="' + id + '">Edit</button>' +
          (ids.length > 1 ? '<button type="button" class="btn btn-sm btn-danger delete-user" data-id="' + id + '">Delete</button>' : '') +
        '</div></div>';
    }).join('');

    el.querySelectorAll('.switch-user').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchUser(btn.getAttribute('data-id'));
        document.getElementById('users-modal').close();
      });
    });
    el.querySelectorAll('.edit-user').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditUserForm(btn.getAttribute('data-id'));
      });
    });
    el.querySelectorAll('.delete-user').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteUser(btn.getAttribute('data-id'));
      });
    });
  }

  function openUsersModal() {
    renderUserList();
    document.getElementById('new-user-name').value = '';
    document.getElementById('edit-user-panel').style.display = 'none';
    document.getElementById('new-user-panel').style.display = 'block';
    renderNewUserAvatars();
    document.getElementById('users-modal').showModal();
  }

  var selectedNewAvatar = '👤';
  var selectedEditAvatar = '👤';

  function renderAvatarPicker(containerId, selected, onSelect) {
    var el = document.getElementById(containerId);
    el.innerHTML = USER_AVATARS.map(function (a) {
      return '<button type="button" class="avatar-pick' + (a === selected ? ' selected' : '') + '" data-av="' + a + '">' + a + '</button>';
    }).join('');
    el.querySelectorAll('.avatar-pick').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onSelect(btn.getAttribute('data-av'));
        renderAvatarPicker(containerId, btn.getAttribute('data-av'), onSelect);
      });
    });
  }

  function renderNewUserAvatars() {
    renderAvatarPicker('new-user-avatars', selectedNewAvatar, function (a) { selectedNewAvatar = a; });
  }

  function openEditUserForm(userId) {
    editingUserId = userId;
    var u = app.users[userId];
    selectedEditAvatar = u.avatar;
    document.getElementById('edit-user-name').value = u.name;
    document.getElementById('new-user-panel').style.display = 'none';
    document.getElementById('edit-user-panel').style.display = 'block';
    renderAvatarPicker('edit-user-avatars', selectedEditAvatar, function (a) { selectedEditAvatar = a; });
  }

  function getVisibleHabits() {
    var list = state.habits.filter(function (h) {
      return state.settings.showArchived || !h.archived;
    });
    if (state.ui.filter !== 'all') {
      list = list.filter(function (h) { return h.category === state.ui.filter; });
    }
    if (state.ui.search.trim()) {
      var q = state.ui.search.trim().toLowerCase();
      list = list.filter(function (h) {
        return h.name.toLowerCase().indexOf(q) >= 0 ||
          (h.description && h.description.toLowerCase().indexOf(q) >= 0);
      });
    }
    list.sort(function (a, b) {
      if (state.ui.sort === 'pinned') {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      if (state.ui.sort === 'streak') {
        return getStreak(b).current - getStreak(a).current;
      }
      if (state.ui.sort === 'progress') {
        return periodProgress(b).percent - periodProgress(a).percent;
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }

  // ─── Render: current-week tracker ───────────────────────────────

  function getWeekDays(offset) {
    offset = offset || 0;
    var weekStart = startOfWeek(new Date());
    weekStart = addDays(weekStart, offset * 7);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    return days;
  }

  function formatShortDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderWeekTracker(habit) {
    var days = getWeekDays(state.ui.weekOffset);
    var weekStart = days[0];
    var weekEnd = days[6];
    var todayKey = toDateKey(new Date());
    var weekTotal = 0;
    days.forEach(function (d) { weekTotal += countOnDate(habit.completions, d); });
    var isCurrentWeek = state.ui.weekOffset === 0;
    var weekLabel = isCurrentWeek ? 'This week' : 'Week of ' + formatShortDate(weekStart);

    var html = '<div class="week-tracker">';
    html += '<p class="week-tracker-range">' + weekLabel + ' · ' + formatShortDate(weekStart) + ' – ' + formatShortDate(weekEnd) + '</p>';
    html += '<div class="week-tracker-grid">';
    days.forEach(function (date, i) {
      var count = countOnDate(habit.completions, date);
      var dateKey = toDateKey(date);
      var isToday = dateKey === todayKey;
      var isFuture = dateKey > todayKey;
      var met = count > 0;
      var metTarget = count >= habit.targetCount;
      html += '<div class="week-day' + (isToday ? ' is-today' : '') + (isFuture ? ' is-future' : '') + '">';
      html += '<span class="week-day-name">' + DAY_LABELS_SHORT[i] + '</span>';
      html += '<span class="week-day-date">' + formatShortDate(date) + '</span>';
      html += '<button type="button" class="week-day-dot' + (met ? ' done' : '') + (metTarget ? ' target-met' : '') +
        (isFuture ? ' disabled' : '') + '" data-habit="' + habit.id + '" data-date="' + dateKey + '" style="' +
        (met ? 'background:' + habit.color + ';border-color:' + habit.color : '') +
        '" title="' + (isFuture ? 'Future day' : 'Click to toggle') + '">';
      if (count > 1) html += '<span class="week-day-count">' + count + '</span>';
      html += '</button></div>';
    });
    html += '</div>';
    html += '<p class="week-tracker-summary">' + weekTotal + ' / ' + (habit.targetCount * 7) + ' slots filled this week</p>';
    if (habit.description) html += '<p class="habit-desc">' + esc(habit.description) + '</p>';
    html += '</div>';
    return html;
  }

  function renderDashboard() {
    var el = document.getElementById('dashboard');
    var active = state.habits.filter(function (h) { return !h.archived; });
    var done = active.filter(isDoneToday).length;
    var pct = active.length > 0 ? Math.round((done / active.length) * 100) : 0;
    var quote = QUOTES[new Date().getDate() % QUOTES.length];
    var days = getWeekDays(state.ui.weekOffset);
    var weekLabel = state.ui.weekOffset === 0 ? 'This week' : formatShortDate(days[0]) + ' – ' + formatShortDate(days[6]);

    el.innerHTML =
      '<div class="dashboard-card">' +
        '<div class="dashboard-left">' +
          '<p class="dashboard-greeting">' + getGreeting() + ' 👋</p>' +
          '<p class="dashboard-quote">' + quote + '</p>' +
          '<div class="week-nav">' +
            '<button type="button" class="btn btn-sm" id="week-prev">← Prev</button>' +
            '<span class="week-nav-label">' + weekLabel + '</span>' +
            '<button type="button" class="btn btn-sm" id="week-next"' + (state.ui.weekOffset >= 0 ? ' disabled' : '') + '>Next →</button>' +
            (state.ui.weekOffset !== 0 ? '<button type="button" class="btn btn-sm" id="week-today">Today</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="dashboard-ring" style="background:conic-gradient(#16a34a 0% ' + pct + '%, var(--ring-bg, #e5e7eb) ' + pct + '% 100%)">' +
          '<div class="dashboard-ring-inner"><strong>' + done + '/' + active.length + '</strong><span>today</span></div>' +
        '</div>' +
      '</div>';

    document.getElementById('week-prev').addEventListener('click', function () {
      state.ui.weekOffset--;
      renderAll();
    });
    document.getElementById('week-next').addEventListener('click', function () {
      if (state.ui.weekOffset < 0) { state.ui.weekOffset++; renderAll(); }
    });
    var todayBtn = document.getElementById('week-today');
    if (todayBtn) todayBtn.addEventListener('click', function () {
      state.ui.weekOffset = 0;
      renderAll();
    });
  }

  function renderHabitsToolbar() {
    var el = document.getElementById('habits-toolbar');
    var chips = '<button type="button" class="chip' + (state.ui.filter === 'all' ? ' active' : '') + '" data-filter="all">All</button>';
    Object.keys(CATEGORIES).forEach(function (key) {
      var c = CATEGORIES[key];
      chips += '<button type="button" class="chip' + (state.ui.filter === key ? ' active' : '') + '" data-filter="' + key + '">' + c.emoji + ' ' + c.label + '</button>';
    });
    el.innerHTML =
      '<div class="toolbar-row">' +
        '<input type="search" id="habit-search" class="habit-search" placeholder="Search habits…" value="' + esc(state.ui.search) + '" />' +
        '<select id="habit-sort" class="habit-sort">' +
          '<option value="pinned"' + (state.ui.sort === 'pinned' ? ' selected' : '') + '>Pinned first</option>' +
          '<option value="name"' + (state.ui.sort === 'name' ? ' selected' : '') + '>Name</option>' +
          '<option value="streak"' + (state.ui.sort === 'streak' ? ' selected' : '') + '>Streak</option>' +
          '<option value="progress"' + (state.ui.sort === 'progress' ? ' selected' : '') + '>Progress</option>' +
        '</select>' +
      '</div>' +
      '<div class="filter-chips">' + chips + '</div>';

    document.getElementById('habit-search').addEventListener('input', function (e) {
      state.ui.search = e.target.value;
      renderHabitsPanel();
    });
    document.getElementById('habit-sort').addEventListener('change', function (e) {
      state.ui.sort = e.target.value;
      renderHabitsPanel();
    });
    el.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.ui.filter = chip.getAttribute('data-filter');
        renderHabitsToolbar();
        renderHabitsPanel();
      });
    });
  }

  function renderSidebarStats() {
    var el = document.getElementById('sidebar-stats');
    var active = state.habits.filter(function (h) { return !h.archived; });
    var totalStreak = 0;
    active.forEach(function (h) { totalStreak += getStreak(h).current; });
    var weekCompletions = 0;
    active.forEach(function (h) { weekCompletions += countInWeek(h.completions, new Date()); });
    el.innerHTML =
      '<div class="mini-stats">' +
        '<div class="mini-stat"><span class="mini-stat-val">' + active.length + '</span><span class="mini-stat-lbl">Active</span></div>' +
        '<div class="mini-stat"><span class="mini-stat-val">' + weekCompletions + '</span><span class="mini-stat-lbl">This week</span></div>' +
        '<div class="mini-stat"><span class="mini-stat-val">' + totalStreak + '</span><span class="mini-stat-lbl">Streaks</span></div>' +
      '</div>';
  }

  function renderAchievements() {
    var el = document.getElementById('achievements-list');
    el.innerHTML = ACHIEVEMENTS.map(function (a) {
      var unlocked = state.gamification.unlocked.indexOf(a.id) >= 0;
      return '<div class="achievement' + (unlocked ? ' unlocked' : ' locked') + '" title="' + esc(a.desc) + '">' +
        '<span class="achievement-icon">' + (unlocked ? a.icon : '🔒') + '</span>' +
        '<span class="achievement-title">' + a.title + '</span></div>';
    }).join('');
  }

  // ─── Render: sidebar ────────────────────────────────────────────

  function renderSidebar() {
    var el = document.getElementById('sidebar-progress');
    var visible = getVisibleHabits().slice(0, 6);
    el.innerHTML = visible.map(function (h) {
      var prog = periodProgress(h);
      var streak = getStreak(h);
      var cat = CATEGORIES[h.category] || CATEGORIES.other;
      return '<div class="progress-card' + (h.archived ? ' archived' : '') + '">' +
        '<div class="progress-card-header"><span>' + h.emoji + '</span><span>' + esc(h.name) + '</span>' +
        (h.pinned ? '<span class="pin">📌</span>' : '') + '</div>' +
        '<div class="meta">' + cat.emoji + ' ' + cat.label +
        (h.reminderTime ? ' · ⏰ ' + h.reminderTime : '') + '</div>' +
        '<div class="meta">' + freqLabel(h) + ' · ' + prog.percent + '% (' + prog.current + '/' + prog.target + ')</div>' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + prog.percent + '%;background:' + h.color + '"></div></div>' +
        '<div class="streak-line"><span class="fire">🔥</span> ' + streak.current + ' ' + streak.unit +
        (streak.current !== 1 ? 's' : '') + ' | Max: ' + streak.max +
        (streak.isNewRecord ? '<span class="new-record">New Record!</span>' : '') +
        '</div></div>';
    }).join('');
  }

  // ─── Render: habits tab ─────────────────────────────────────────

  function renderHabitsPanel() {
    var el = document.getElementById('panel-habits');
    var habits = getVisibleHabits();
    if (habits.length === 0) {
      el.innerHTML = '<p class="empty-state">No habits match your filters. <button type="button" class="btn btn-primary" id="empty-add">+ Add Habit</button></p>';
      var addBtn = document.getElementById('empty-add');
      if (addBtn) addBtn.addEventListener('click', function () { openHabitModal(); });
      return;
    }
    el.innerHTML = '<div class="habits-grid">' + habits.map(function (h) {
      var done = isDoneToday(h);
      var cat = CATEGORIES[h.category] || CATEGORIES.other;
      var prog = periodProgress(h);
      var timeLabel = (h.startTime || h.endTime) ? ' · ' + formatTimeRange(h.startTime, h.endTime) : '';
      var metricLabel = getMetricLabel(h, toDateKey(new Date()));
      var extraLabel = metricLabel ? ' · ' + (isWalkHabit(h) ? '👣 ' : isWaterHabit(h) ? '💧 ' : '') + metricLabel : '';
      return '<div class="habit-card' + (h.archived ? ' archived' : '') + (h.pinned ? ' pinned' : '') + '" data-id="' + h.id + '" style="--habit-color:' + h.color + '">' +
        '<div class="habit-card-header">' +
        '<div class="habit-card-title">' +
        '<span class="habit-emoji">' + h.emoji + '</span>' +
        '<div><span class="habit-name">' + esc(h.name) + '</span>' +
        '<span class="habit-meta">' + cat.label + ' · ' + freqLabel(h) +
        (h.reminderTime ? ' · ⏰ ' + h.reminderTime : '') + timeLabel + extraLabel + '</span></div>' +
        (h.pinned ? '<span class="pin-badge">📌</span>' : '') +
        '</div>' +
        '<div class="habit-actions">' +
        (isWalkHabit(h) ? '<button type="button" class="btn btn-outline log-steps" data-id="' + h.id + '" title="Log steps">👣 Steps</button>' : '') +
        (isWaterHabit(h) ? '<button type="button" class="btn btn-outline log-liters" data-id="' + h.id + '" title="Log liters">💧 Liters</button>' : '') +
        '<button type="button" class="btn btn-outline do-habit" data-id="' + h.id + '">Do Habit</button>' +
        '<button type="button" class="btn btn-icon undo-one" data-id="' + h.id + '" title="Undo today">↩</button>' +
        '</div></div>' +
        '<div class="habit-progress-pill">' + prog.current + '/' + prog.target + ' ' + prog.label.toLowerCase() + ' goal</div>' +
        '<div class="habit-card-body">' + renderWeekTracker(h) + '</div>' +
        '<div class="habit-status ' + (done ? 'done' : 'not-done') + '">' +
        (done ? '✓ Done Today' : '✕ Not Done Today') + '</div></div>';
    }).join('') + '</div>';

    el.querySelectorAll('.do-habit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        logCompletion(btn.getAttribute('data-id'), toDateKey(new Date()), 'button');
      });
    });
    el.querySelectorAll('.log-steps').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var h = state.habits.find(function (x) { return x.id === id; });
        if (!h) return;
        promptMetricLog(h, toDateKey(new Date()), 'today');
      });
    });
    el.querySelectorAll('.log-liters').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var h = state.habits.find(function (x) { return x.id === id; });
        if (!h) return;
        promptMetricLog(h, toDateKey(new Date()), 'today');
      });
    });
    el.querySelectorAll('.undo-one').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeOneCompletion(btn.getAttribute('data-id'), toDateKey(new Date()));
      });
    });
    el.querySelectorAll('.week-day-dot:not(.disabled)').forEach(function (dot) {
      dot.addEventListener('click', function () {
        toggleDayCompletion(dot.getAttribute('data-habit'), dot.getAttribute('data-date'));
      });
    });
  }

  // ─── Render: today's tracker ────────────────────────────────────

  var TRACKER_START_HOUR = 6;
  var TRACKER_END_HOUR = 22;
  var TRACKER_HOUR_HEIGHT = 52;

  function getTrackerDate() {
    return addDays(new Date(), state.ui.trackerDayOffset || 0);
  }

  function isHabitScheduledOnDate(h, date) {
    if (h.archived) return false;
    if (!state.settings.showArchived && h.archived) return false;
    var dateKey = toDateKey(date);
    if (h.startDate && dateKey < h.startDate) return false;
    return true;
  }

  function layoutScheduledEvents(events) {
    if (!events.length) return [];
    var layout = events.slice().sort(function (a, b) {
      return a.startM - b.startM || (b.endM - b.startM) - (a.endM - a.startM);
    }).map(function (ev) {
      return Object.assign({}, ev, { column: 0, totalColumns: 1 });
    });

    layout.forEach(function (ev, i) {
      var usedCols = {};
      for (var j = 0; j < i; j++) {
        var other = layout[j];
        if (other.startM < ev.endM && other.endM > ev.startM) {
          usedCols[other.column] = true;
        }
      }
      var col = 0;
      while (usedCols[col]) col++;
      ev.column = col;
    });

    layout.forEach(function (ev) {
      var cluster = layout.filter(function (other) {
        return other.startM < ev.endM && other.endM > ev.startM;
      });
      var total = 1;
      cluster.forEach(function (c) {
        if (c.column + 1 > total) total = c.column + 1;
      });
      cluster.forEach(function (c) { c.totalColumns = total; });
    });

    return layout;
  }

  function renderTodayPanel() {
    var el = document.getElementById('panel-today');
    if (!el) return;

    var viewDate = getTrackerDate();
    var dateKey = toDateKey(viewDate);
    var isToday = dateKey === toDateKey(new Date());
    var dayName = viewDate.toLocaleDateString('en-US', { weekday: 'long' });
    var dateLabel = viewDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var habits = state.habits.filter(function (h) { return isHabitScheduledOnDate(h, viewDate); });
    var scheduled = [];
    var unscheduled = [];

    habits.forEach(function (h) {
      var schedule = resolveScheduleTimes(h);
      if (schedule) {
        scheduled.push({
          habit: h,
          startM: schedule.startM,
          endM: schedule.endM,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        });
      } else {
        unscheduled.push(h);
      }
    });

    var laidOut = layoutScheduledEvents(scheduled);

    var totalHours = TRACKER_END_HOUR - TRACKER_START_HOUR;
    var gridHeight = totalHours * TRACKER_HOUR_HEIGHT;
    var dayStartM = TRACKER_START_HOUR * 60;

    var timeLabels = '';
    for (var hour = TRACKER_START_HOUR; hour <= TRACKER_END_HOUR; hour++) {
      var top = (hour - TRACKER_START_HOUR) * TRACKER_HOUR_HEIGHT;
      var label = (hour === 12 ? '12 PM' : hour > 12 ? (hour - 12) + ' PM' : hour + ' AM');
      timeLabels += '<div class="today-hour-label" style="top:' + top + 'px">' + label + '</div>';
    }

    var hourLines = '';
    for (var h = TRACKER_START_HOUR; h <= TRACKER_END_HOUR; h++) {
      var lineTop = (h - TRACKER_START_HOUR) * TRACKER_HOUR_HEIGHT;
      hourLines += '<div class="today-hour-line" style="top:' + lineTop + 'px"></div>';
      hourLines += '<div class="today-half-hour-line" style="top:' + (lineTop + TRACKER_HOUR_HEIGHT / 2) + 'px"></div>';
    }

    var events = laidOut.map(function (item) {
      var h = item.habit;
      var top = ((item.startM - dayStartM) / 60) * TRACKER_HOUR_HEIGHT;
      var durationM = item.endM - item.startM;
      var height = Math.max(24, (durationM / 60) * TRACKER_HOUR_HEIGHT);
      var done = countOnDate(h.completions, viewDate) > 0;
      var metricInfo = getMetricLabel(h, dateKey);
      var metricHtml = metricInfo ? '<span class="today-event-metric">' + metricInfo + '</span>' : '';
      var colWidth = 100 / item.totalColumns;
      var leftPct = item.column * colWidth;
      return '<div class="today-event' + (done ? ' done' : '') + '" data-id="' + h.id + '"' +
        ' style="top:' + top + 'px;height:' + height + 'px;left:calc(2px + (100% - 8px) * ' + (leftPct / 100) + ');' +
        'width:calc((100% - 8px) * ' + (colWidth / 100) + ' - 4px);background:' + h.color + '22;border-left-color:' + h.color + '">' +
        '<div class="today-event-title">' + h.emoji + ' ' + esc(h.name) + (done ? ' ✓' : '') + '</div>' +
        '<div class="today-event-time">' + formatTimeRange(item.startTime, item.endTime) + '</div>' +
        metricHtml +
        '</div>';
    }).join('');

    var nowLine = '';
    if (isToday) {
      var now = new Date();
      var nowM = now.getHours() * 60 + now.getMinutes();
      if (nowM >= dayStartM && nowM <= TRACKER_END_HOUR * 60) {
        var nowTop = ((nowM - dayStartM) / 60) * TRACKER_HOUR_HEIGHT;
        nowLine = '<div class="today-now-line" style="top:' + nowTop + 'px"><span class="today-now-dot"></span></div>';
      }
    }

    var unscheduledHtml = unscheduled.length ? '<div class="today-allday">' +
      '<div class="today-allday-label">Unscheduled</div>' +
      '<div class="today-allday-items">' + unscheduled.map(function (h) {
        var done = countOnDate(h.completions, viewDate) > 0;
        var metricInfo = getMetricLabel(h, dateKey);
        var metricChip = metricInfo ? ' · ' + metricInfo : '';
        return '<button type="button" class="today-allday-chip' + (done ? ' done' : '') + '" data-id="' + h.id + '" style="border-color:' + h.color + '">' +
          h.emoji + ' ' + esc(h.name) + (done ? ' ✓' : '') + metricChip + '</button>';
      }).join('') + '</div></div>' : '';

    el.innerHTML =
      '<div class="today-tracker">' +
        '<div class="today-header">' +
          '<div class="today-nav">' +
            '<button type="button" class="btn btn-sm" id="tracker-today-btn"' + (isToday ? ' disabled' : '') + '>Today</button>' +
            '<button type="button" class="btn btn-icon" id="tracker-prev" aria-label="Previous day">‹</button>' +
            '<button type="button" class="btn btn-icon" id="tracker-next" aria-label="Next day">›</button>' +
          '</div>' +
          '<h2 class="today-date-title">' + dayName + ' <span>' + viewDate.getDate() + '</span></h2>' +
          '<p class="today-date-sub">' + dateLabel + '</p>' +
        '</div>' +
        unscheduledHtml +
        '<div class="today-scroll">' +
        '<div class="today-grid">' +
          '<div class="today-time-col" style="height:' + gridHeight + 'px">' + timeLabels + '</div>' +
          '<div class="today-day-col">' +
            '<div class="today-day-header">' + dayName.slice(0, 3) + ' ' + viewDate.getDate() + '</div>' +
            '<div class="today-timeline" style="height:' + gridHeight + 'px">' +
              hourLines + events + nowLine +
            '</div>' +
          '</div>' +
        '</div>' +
        '</div>' +
        '<div class="today-legend">' +
          '<span>Click a habit block to mark complete</span>' +
          (habits.some(function (h) { return isWalkHabit(h) || isWaterHabit(h); }) ?
            '<span> · Double-click to log steps or liters</span>' : '') +
        '</div>' +
      '</div>';

    document.getElementById('tracker-today-btn').addEventListener('click', function () {
      state.ui.trackerDayOffset = 0;
      renderTodayPanel();
    });
    document.getElementById('tracker-prev').addEventListener('click', function () {
      state.ui.trackerDayOffset = (state.ui.trackerDayOffset || 0) - 1;
      renderTodayPanel();
    });
    document.getElementById('tracker-next').addEventListener('click', function () {
      state.ui.trackerDayOffset = (state.ui.trackerDayOffset || 0) + 1;
      renderTodayPanel();
    });

    el.querySelectorAll('.today-event').forEach(function (block) {
      block.addEventListener('click', function () {
        var id = block.getAttribute('data-id');
        var h = state.habits.find(function (x) { return x.id === id; });
        if (!h) return;
        if (countOnDate(h.completions, viewDate) > 0) {
          removeOneCompletion(id, dateKey);
        } else {
          logCompletion(id, dateKey, 'tracker');
        }
      });
      block.addEventListener('dblclick', function (e) {
        e.preventDefault();
        var id = block.getAttribute('data-id');
        var h = state.habits.find(function (x) { return x.id === id; });
        if (!h || (!isWalkHabit(h) && !isWaterHabit(h))) return;
        promptMetricLog(h, dateKey, dateLabel);
      });
    });

    el.querySelectorAll('.today-allday-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var id = chip.getAttribute('data-id');
        var h = state.habits.find(function (x) { return x.id === id; });
        if (!h) return;
        if (countOnDate(h.completions, viewDate) > 0) {
          removeOneCompletion(id, dateKey);
        } else {
          logCompletion(id, dateKey, 'tracker');
        }
      });
      chip.addEventListener('dblclick', function (e) {
        e.preventDefault();
        var id = chip.getAttribute('data-id');
        var h = state.habits.find(function (x) { return x.id === id; });
        if (!h || (!isWalkHabit(h) && !isWaterHabit(h))) return;
        promptMetricLog(h, dateKey, '');
      });
    });
  }

  // ─── Render: monthly tracker ──────────────────────────────────────

  function renderMonthlyPanel() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var el = document.getElementById('panel-monthly');

    var years = [];
    state.habits.forEach(function (h) {
      h.completions.forEach(function (c) {
        var y = parseDateKey(completionDateKey(c)).getFullYear();
        if (years.indexOf(y) === -1) years.push(y);
      });
    });
    years.sort();
    if (years.indexOf(year) === -1) years.push(year);
    years.sort();

    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    el.innerHTML = '<div class="period-controls">' +
      '<label>Year <select id="monthly-year">' + years.map(function (y) {
        return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>';
      }).join('') + '</select></label>' +
      '<label>Month <select id="monthly-month">' + months.map(function (m, i) {
        return '<option value="' + i + '"' + (i === month ? ' selected' : '') + '>' + m + '</option>';
      }).join('') + '</select></label></div>' +
      '<div class="period-grid" id="monthly-grid"></div>';

    function draw() {
      var y = parseInt(document.getElementById('monthly-year').value, 10);
      var m = parseInt(document.getElementById('monthly-month').value, 10);
      var first = new Date(y, m, 1);
      var last = new Date(y, m + 1, 0);
      var startPad = (first.getDay() + 6) % 7;
      var todayKey = toDateKey(new Date());

      document.getElementById('monthly-grid').innerHTML = state.habits.map(function (h) {
        var total = countInMonth(h.completions, first);
        var cal = '<div class="period-calendar">';
        ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(function (d) {
          cal += '<div class="period-cal-header">' + d + '</div>';
        });
        for (var i = 0; i < startPad; i++) cal += '<div class="period-cal-cell empty"></div>';
        for (var day = 1; day <= last.getDate(); day++) {
          var dd = new Date(y, m, day);
          var cnt = countOnDate(h.completions, dd);
          var isToday = toDateKey(dd) === todayKey;
          cal += '<div class="period-cal-cell' + (cnt > 0 ? ' filled' : '') + (isToday ? ' today' : '') + '"' +
            (cnt > 0 ? ' style="background:' + h.color + '"' : '') + '>' +
            (cnt > 0 ? cnt : day) + '</div>';
        }
        cal += '</div>';
        return '<div class="period-card"><h3>' + h.emoji + ' ' + esc(h.name) + '</h3>' + cal +
          '<div class="period-summary">Completions this month: <strong>' + total + '</strong> / target ' + h.targetCount + ' (' + h.frequency + ')</div></div>';
      }).join('');
    }

    document.getElementById('monthly-year').addEventListener('change', draw);
    document.getElementById('monthly-month').addEventListener('change', draw);
    draw();
  }

  // ─── Render: quarterly tracker ────────────────────────────────────

  function renderQuarterlyPanel() {
    var year = new Date().getFullYear();
    var el = document.getElementById('panel-quarterly');

    el.innerHTML = '<div class="period-controls"><label>Year <select id="quarterly-year">' +
      [year - 1, year, year + 1].map(function (y) {
        return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>';
      }).join('') + '</select></label></div><div class="period-grid" id="quarterly-grid"></div>';

    function draw() {
      var y = parseInt(document.getElementById('quarterly-year').value, 10);
      document.getElementById('quarterly-grid').innerHTML = state.habits.map(function (h) {
        var blocks = '<div class="quarter-blocks">';
        for (var q = 1; q <= 4; q++) {
          var cnt = countInQuarter(h.completions, y, q);
          var met = h.frequency === 'monthly' ? cnt >= h.targetCount : cnt > 0;
          blocks += '<div class="quarter-block' + (met ? ' filled' : '') + '"' +
            (met ? ' style="background:' + h.color + '"' : '') + '>' +
            'Q' + q + '<br><strong>' + cnt + '</strong></div>';
        }
        blocks += '</div>';
        var total = countInYear(h.completions, y);
        return '<div class="period-card"><h3>' + h.emoji + ' ' + esc(h.name) + '</h3>' + blocks +
          '<div class="period-summary">Year total: <strong>' + total + '</strong> completions</div></div>';
      }).join('');
    }

    document.getElementById('quarterly-year').addEventListener('change', draw);
    draw();
  }

  // ─── Render: yearly tracker ───────────────────────────────────────

  function renderYearlyPanel() {
    var el = document.getElementById('panel-yearly');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    el.innerHTML = '<div class="period-grid" id="yearly-grid"></div>';

    document.getElementById('yearly-grid').innerHTML = state.habits.map(function (h) {
      var years = {};
      h.completions.forEach(function (c) {
        years[parseDateKey(completionDateKey(c)).getFullYear()] = true;
      });
      var yearList = Object.keys(years).map(Number).sort();
      if (yearList.length === 0) yearList = [new Date().getFullYear()];

      return yearList.map(function (y) {
        var monthBlocks = '<div class="year-months">';
        for (var m = 0; m < 12; m++) {
          var cnt = h.completions.filter(function (c) {
            var d = parseDateKey(completionDateKey(c));
            return d.getFullYear() === y && d.getMonth() === m;
          }).length;
          monthBlocks += '<div class="year-month' + (cnt > 0 ? ' filled' : '') + '"' +
            (cnt > 0 ? ' style="background:' + h.color + '"' : '') + '>' +
            months[m] + '<br><strong>' + cnt + '</strong></div>';
        }
        monthBlocks += '</div>';
        return '<div class="period-card"><h3>' + h.emoji + ' ' + esc(h.name) + ' — ' + y + '</h3>' + monthBlocks +
          '<div class="period-summary">Year total: <strong>' + countInYear(h.completions, y) + '</strong></div></div>';
      }).join('');
    }).join('');
  }

  // ─── Render: stats ────────────────────────────────────────────────

  function getLast30DaysActivity() {
    var days = [];
    var today = new Date();
    for (var i = 29; i >= 0; i--) {
      var d = addDays(today, -i);
      var count = 0;
      state.habits.forEach(function (h) {
        count += countOnDate(h.completions, d);
      });
      days.push({ date: d, count: count, key: toDateKey(d) });
    }
    return days;
  }

  function buildDonutGradient(habits, totalAll) {
    if (totalAll === 0) return '#e5e7eb';
    var cum = 0;
    var stops = habits.map(function (h) {
      var pct = (h.completions.length / totalAll) * 100;
      var start = cum;
      cum += pct;
      return h.color + ' ' + start + '% ' + cum + '%';
    });
    return 'conic-gradient(' + stops.join(', ') + ')';
  }

  function renderActivitySvg(days) {
    var max = 1;
    days.forEach(function (d) { if (d.count > max) max = d.count; });
    var w = 640;
    var h = 140;
    var padL = 28;
    var padB = 24;
    var padT = 12;
    var chartW = w - padL - 8;
    var chartH = h - padB - padT;
    var barW = chartW / days.length;
    var bars = days.map(function (d, i) {
      var bh = max > 0 ? (d.count / max) * chartH : 0;
      var x = padL + i * barW + 1;
      var y = padT + chartH - bh;
      var label = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return '<rect class="activity-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(barW - 2, 2).toFixed(1) + '" height="' + Math.max(bh, 0).toFixed(1) + '" rx="2" fill="#3b9fd9" opacity="0.85">' +
        '<title>' + label + ': ' + d.count + ' completion' + (d.count !== 1 ? 's' : '') + '</title></rect>';
    }).join('');
    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (chartH / 4) * g;
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - 8) + '" y2="' + gy.toFixed(1) + '" stroke="#f3f4f6" stroke-width="1"/>';
    }
    return '<svg class="activity-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="30 day activity">' +
      grid + bars +
      '<text x="' + padL + '" y="' + (h - 6) + '" class="chart-axis-label">30 days ago</text>' +
      '<text x="' + (w - 72) + '" y="' + (h - 6) + '" class="chart-axis-label">Today</text></svg>';
  }

  function renderStatsPanel() {
    var el = document.getElementById('panel-stats');
    if (!el) return;

    if (state.habits.length === 0) {
      el.innerHTML = '<p class="empty-state">No habits yet. Add a habit to see stats.</p>';
      return;
    }

    var totalAll = 0;
    var doneToday = state.habits.filter(isDoneToday).length;
    var habitCount = state.habits.length;
    state.habits.forEach(function (h) { totalAll += h.completions.length; });

    var maxCompletions = 1;
    state.habits.forEach(function (h) {
      if (h.completions.length > maxCompletions) maxCompletions = h.completions.length;
    });

    var donutBg = buildDonutGradient(state.habits, totalAll);
    var todayPct = habitCount > 0 ? Math.round((doneToday / habitCount) * 100) : 0;
    var activityDays = getLast30DaysActivity();

    var barChartHtml = state.habits.map(function (h) {
      var pct = maxCompletions > 0 ? (h.completions.length / maxCompletions) * 100 : 0;
      return '<div class="bar-row" title="' + esc(h.name) + ': ' + h.completions.length + ' completions">' +
        '<span class="bar-emoji">' + h.emoji + '</span>' +
        '<span class="bar-name">' + esc(h.name) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + h.color + '"></div></div>' +
        '<span class="bar-val">' + h.completions.length + '</span></div>';
    }).join('');

    var streakChartHtml = state.habits.map(function (h) {
      var streak = getStreak(h);
      var maxS = 1;
      state.habits.forEach(function (x) {
        var s = getStreak(x).max;
        if (s > maxS) maxS = s;
      });
      var pct = maxS > 0 ? (streak.max / maxS) * 100 : 0;
      return '<div class="bar-row" title="Best streak: ' + streak.max + ' ' + streak.unit + (streak.max !== 1 ? 's' : '') + '">' +
        '<span class="bar-emoji">' + h.emoji + '</span>' +
        '<span class="bar-name">' + esc(h.name) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + h.color + '"></div></div>' +
        '<span class="bar-val">' + streak.max + '</span></div>';
    }).join('');

    var legendHtml = state.habits.map(function (h) {
      var pct = totalAll > 0 ? Math.round((h.completions.length / totalAll) * 100) : 0;
      return '<div class="donut-legend-item"><span class="donut-swatch" style="background:' + h.color + '"></span>' +
        '<span>' + h.emoji + ' ' + esc(h.name) + '</span><span class="donut-pct">' + pct + '%</span></div>';
    }).join('');

    el.innerHTML =
      '<div class="stats-layout">' +
        '<div class="stats-charts-row">' +
          '<div class="chart-card">' +
            '<h3>📊 Today\'s Progress</h3>' +
            '<div class="ring-wrap">' +
              '<div class="ring-chart" style="background:conic-gradient(#16a34a 0% ' + todayPct + '%, #e5e7eb ' + todayPct + '% 100%)">' +
                '<div class="ring-center"><strong>' + doneToday + '/' + habitCount + '</strong><span>done</span></div></div>' +
            '</div>' +
            '<p class="chart-caption">' + todayPct + '% of habits completed today</p>' +
          '</div>' +
          '<div class="chart-card chart-card-wide">' +
            '<h3>📈 Last 30 Days Activity</h3>' +
            renderActivitySvg(activityDays) +
            '<p class="chart-caption">Hover bars for daily totals (all habits combined)</p>' +
          '</div>' +
          '<div class="chart-card">' +
            '<h3>🍩 Completion Share</h3>' +
            '<div class="donut-wrap">' +
              '<div class="donut-chart" style="background:' + donutBg + '">' +
                '<div class="donut-hole"><strong>' + totalAll + '</strong><span>total</span></div></div>' +
            '</div>' +
            '<div class="donut-legend">' + legendHtml + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="stats-charts-row">' +
          '<div class="chart-card">' +
            '<h3>🏆 Completions by Habit</h3>' +
            '<div class="bar-chart">' + barChartHtml + '</div>' +
          '</div>' +
          '<div class="chart-card">' +
            '<h3>🔥 Best Streaks</h3>' +
            '<div class="bar-chart">' + streakChartHtml + '</div>' +
          '</div>' +
        '</div>' +
        '<h3 class="stats-detail-heading">Habit Details</h3>' +
        '<div class="stats-grid">' +
          state.habits.map(function (h) {
            var prog = periodProgress(h);
            var streak = getStreak(h);
            var progPct = prog.target > 0 ? Math.min(100, Math.round((prog.current / prog.target) * 100)) : 0;
            return '<div class="stat-card stat-card-interactive">' +
              '<h3>' + h.emoji + ' ' + esc(h.name) + '</h3>' +
              '<div class="mini-ring-wrap">' +
                '<div class="mini-ring" style="background:conic-gradient(' + h.color + ' 0% ' + progPct + '%, #f3f4f6 ' + progPct + '% 100%)">' +
                  '<div class="mini-ring-center">' + progPct + '%</div></div>' +
                '<div class="mini-ring-label">Current ' + prog.label.toLowerCase() + ' goal</div>' +
              '</div>' +
              '<div class="stat-row"><span class="stat-label">All-time completions</span><span class="stat-value">' + h.completions.length + '</span></div>' +
              '<div class="stat-row"><span class="stat-label">Current period</span><span class="stat-value">' + prog.current + '/' + prog.target + '</span></div>' +
              '<div class="stat-row"><span class="stat-label">Current streak</span><span class="stat-value">' + streak.current + ' ' + streak.unit + (streak.current !== 1 ? 's' : '') + '</span></div>' +
              '<div class="stat-row"><span class="stat-label">Best streak</span><span class="stat-value">' + streak.max + ' ' + streak.unit + (streak.max !== 1 ? 's' : '') + '</span></div>' +
              '<div class="stat-row"><span class="stat-label">Frequency</span><span class="stat-value">' + freqLabel(h) + '</span></div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';

    try {
      el.querySelectorAll('.activity-bar').forEach(function (bar) {
        bar.addEventListener('mouseenter', function () { bar.setAttribute('fill', '#2563eb'); });
        bar.addEventListener('mouseleave', function () { bar.setAttribute('fill', '#3b9fd9'); });
      });
    } catch (e) { /* SVG hover optional */ }
  }

  // ─── Render: manage ───────────────────────────────────────────────

  function renderManageList() {
    var el = document.getElementById('manage-list');
    el.innerHTML = state.habits.map(function (h) {
      var cat = CATEGORIES[h.category] || CATEGORIES.other;
      return '<div class="manage-item"><div class="manage-item-info"><span>' + h.emoji + '</span><span>' + esc(h.name) +
        ' <small style="color:#9ca3af">(' + cat.label + ' · ' + freqLabel(h) + ')</small>' +
        (h.archived ? ' <span class="archived-tag">Archived</span>' : '') + '</span></div>' +
        '<div class="manage-item-actions">' +
        '<button type="button" class="btn archive-habit" data-id="' + h.id + '">' + (h.archived ? 'Restore' : 'Archive') + '</button>' +
        '<button type="button" class="btn edit-habit" data-id="' + h.id + '">Edit</button>' +
        '<button type="button" class="btn btn-danger delete-habit" data-id="' + h.id + '">Delete</button></div></div>';
    }).join('');

    el.querySelectorAll('.edit-habit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openHabitModal(btn.getAttribute('data-id'));
      });
    });
    el.querySelectorAll('.archive-habit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var h = state.habits.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        if (h) { h.archived = !h.archived; save(); renderManageList(); renderAll(); }
      });
    });
    el.querySelectorAll('.delete-habit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Delete this habit and all its records?')) {
          state.habits = state.habits.filter(function (h) { return h.id !== btn.getAttribute('data-id'); });
          save();
          renderManageList();
          renderAll();
        }
      });
    });
  }

  // ─── Modals ───────────────────────────────────────────────────────

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  var selectedColor = COLORS[0];

  function renderColorPicker() {
    document.getElementById('color-options').innerHTML = COLORS.map(function (c) {
      return '<button type="button" class="color-swatch' + (c === selectedColor ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    document.querySelectorAll('.color-swatch').forEach(function (sw) {
      sw.addEventListener('click', function () {
        selectedColor = sw.getAttribute('data-color');
        renderColorPicker();
      });
    });
  }

  function openHabitModal(id) {
    editingId = id || null;
    var modal = document.getElementById('habit-modal');
    document.getElementById('habit-modal-title').textContent = id ? 'Edit Habit' : 'Add New Habit';

    var templateRow = document.getElementById('template-row');
    if (!id) {
      templateRow.innerHTML = '<p class="template-label">Quick templates:</p>' +
        TEMPLATES.map(function (t, i) {
          return '<button type="button" class="template-btn" data-idx="' + i + '">' + t.emoji + ' ' + t.name + '</button>';
        }).join('');
      templateRow.querySelectorAll('.template-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var t = TEMPLATES[parseInt(btn.getAttribute('data-idx'), 10)];
          document.getElementById('habit-name').value = t.name;
          document.getElementById('habit-emoji').value = t.emoji;
          document.getElementById('habit-target').value = t.targetCount;
          document.getElementById('habit-frequency').value = t.frequency;
          document.getElementById('habit-category').value = t.category;
          document.getElementById('habit-start-time').value = t.startTime || '';
          document.getElementById('habit-end-time').value = t.endTime || '';
          document.getElementById('habit-track-steps').checked = !!t.trackSteps;
          document.getElementById('habit-step-target').value = t.stepTarget || 10000;
          document.getElementById('habit-track-liters').checked = !!t.trackLiters;
          document.getElementById('habit-liter-target').value = t.literTarget || 2;
          toggleStepFields();
          toggleLiterFields();
          selectedColor = t.color;
          renderColorPicker();
        });
      });
      templateRow.style.display = 'block';
    } else {
      templateRow.innerHTML = '';
      templateRow.style.display = 'none';
    }

    if (id) {
      var h = state.habits.find(function (x) { return x.id === id; });
      document.getElementById('habit-id').value = h.id;
      document.getElementById('habit-name').value = h.name;
      document.getElementById('habit-description').value = h.description || '';
      document.getElementById('habit-emoji').value = h.emoji;
      document.getElementById('habit-target').value = h.targetCount;
      document.getElementById('habit-frequency').value = h.frequency;
      document.getElementById('habit-category').value = h.category || 'other';
      document.getElementById('habit-start').value = h.startDate;
      document.getElementById('habit-reminder').value = h.reminderTime || '';
      document.getElementById('habit-start-time').value = h.startTime || '';
      document.getElementById('habit-end-time').value = h.endTime || '';
      document.getElementById('habit-track-steps').checked = !!h.trackSteps;
      document.getElementById('habit-step-target').value = h.stepTarget || 10000;
      document.getElementById('habit-track-liters').checked = !!h.trackLiters;
      document.getElementById('habit-liter-target').value = h.literTarget || 2;
      document.getElementById('habit-pinned').checked = !!h.pinned;
      toggleStepFields();
      toggleLiterFields();
      selectedColor = h.color;
    } else {
      document.getElementById('habit-id').value = '';
      document.getElementById('habit-name').value = '';
      document.getElementById('habit-description').value = '';
      document.getElementById('habit-emoji').value = '⭐';
      document.getElementById('habit-target').value = 1;
      document.getElementById('habit-frequency').value = 'daily';
      document.getElementById('habit-category').value = 'health';
      document.getElementById('habit-start').value = toDateKey(new Date());
      document.getElementById('habit-reminder').value = '';
      document.getElementById('habit-start-time').value = '';
      document.getElementById('habit-end-time').value = '';
      document.getElementById('habit-track-steps').checked = false;
      document.getElementById('habit-step-target').value = 10000;
      document.getElementById('habit-track-liters').checked = false;
      document.getElementById('habit-liter-target').value = 2;
      document.getElementById('habit-pinned').checked = false;
      toggleStepFields();
      toggleLiterFields();
      selectedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    renderColorPicker();
    modal.showModal();
  }

  function renderMorePanel() {
    document.getElementById('setting-dark').checked = state.settings.darkMode;
    document.getElementById('setting-celebrate').checked = state.settings.celebrate;
    document.getElementById('setting-archived').checked = state.settings.showArchived;
    document.getElementById('btn-undo').disabled = state.undoStack.length === 0;
    renderManageList();
  }

  function saveSettingsFromForm() {
    state.settings.darkMode = document.getElementById('setting-dark').checked;
    state.settings.celebrate = document.getElementById('setting-celebrate').checked;
    state.settings.showArchived = document.getElementById('setting-archived').checked;
    save();
    renderAll();
  }

  // ─── Tabs ─────────────────────────────────────────────────────────

  function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + tabId);
    });
    var showHabitsUi = tabId === 'habits';
    document.getElementById('dashboard').style.display = showHabitsUi ? 'block' : 'none';
    document.getElementById('habits-toolbar').style.display = showHabitsUi ? 'block' : 'none';
    if (tabId === 'today') renderTodayPanel();
    if (tabId === 'monthly') renderMonthlyPanel();
    if (tabId === 'quarterly') renderQuarterlyPanel();
    if (tabId === 'yearly') renderYearlyPanel();
    if (tabId === 'stats') renderStatsPanel();
    if (tabId === 'more') renderMorePanel();
    if (tabId === 'habits') { renderDashboard(); renderHabitsToolbar(); renderHabitsPanel(); }
  }

  function renderAll() {
    applyTheme();
    renderCriticalUI();
    renderSidebar();
    renderActiveSecondaryPanel();
  }

  // ─── Events ───────────────────────────────────────────────────────

  document.getElementById('habit-track-steps').addEventListener('change', toggleStepFields);
  document.getElementById('habit-track-liters').addEventListener('change', toggleLiterFields);

  document.getElementById('btn-add-habit').addEventListener('click', function () { openHabitModal(); });

  document.getElementById('habit-cancel').addEventListener('click', function () {
    document.getElementById('habit-modal').close();
  });

  document.getElementById('habit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {
      name: document.getElementById('habit-name').value.trim(),
      description: document.getElementById('habit-description').value.trim(),
      emoji: document.getElementById('habit-emoji').value || '⭐',
      targetCount: parseInt(document.getElementById('habit-target').value, 10) || 1,
      frequency: document.getElementById('habit-frequency').value,
      category: document.getElementById('habit-category').value,
      startDate: document.getElementById('habit-start').value,
      reminderTime: document.getElementById('habit-reminder').value,
      startTime: normalizeTimeValue(document.getElementById('habit-start-time').value),
      endTime: normalizeTimeValue(document.getElementById('habit-end-time').value),
      trackSteps: document.getElementById('habit-track-steps').checked,
      stepTarget: parseInt(document.getElementById('habit-step-target').value, 10) || 10000,
      trackLiters: document.getElementById('habit-track-liters').checked,
      literTarget: parseFloat(document.getElementById('habit-liter-target').value) || 2,
      pinned: document.getElementById('habit-pinned').checked,
      color: selectedColor,
    };
    if (!data.name) return;
    if (data.startTime && !data.endTime) {
      data.endTime = minutesToTimeString(parseTimeToMinutes(data.startTime) + 60);
      showToast('End time set to 1 hour after start', 'info');
    }
    if (data.endTime && !data.startTime) {
      showToast('Please set a start time when using an end time', 'info');
      return;
    }

    if (editingId) {
      var h = state.habits.find(function (x) { return x.id === editingId; });
      var completions = h.completions;
      var stepLogs = h.stepLogs;
      var literLogs = h.literLogs;
      Object.assign(h, data);
      h.completions = completions;
      h.stepLogs = stepLogs || {};
      h.literLogs = literLogs || {};
    } else {
      state.habits.push(Object.assign({
        id: uid(), completions: [], stepLogs: {}, literLogs: {}, archived: false,
      }, data));
      showToast('Habit created: ' + data.name, 'success');
    }
    save();
    document.getElementById('habit-modal').close();
    renderAll();
  });

  document.getElementById('setting-dark').addEventListener('change', saveSettingsFromForm);
  document.getElementById('setting-celebrate').addEventListener('change', saveSettingsFromForm);
  document.getElementById('setting-archived').addEventListener('change', saveSettingsFromForm);

  document.getElementById('btn-reset-data').addEventListener('click', function () {
    if (confirm('Clear ALL completion records? Habits will be kept.')) {
      clearAllCompletions();
      state.gamification = { xp: 0, unlocked: [] };
      state.undoStack = [];
      document.getElementById('btn-undo').disabled = true;
      save();
      renderAll();
      showToast('All completion data reset', 'info');
    }
  });

  document.getElementById('btn-undo').addEventListener('click', undo);

  document.getElementById('btn-export').addEventListener('click', exportDataFile);

  document.getElementById('btn-export-user').addEventListener('click', function () {
    exportCurrentUser();
  });

  document.getElementById('btn-create-user').addEventListener('click', function () {
    var name = document.getElementById('new-user-name').value;
    if (createUser(name, selectedNewAvatar)) {
      document.getElementById('new-user-name').value = '';
      renderUserList();
    }
  });

  document.getElementById('btn-save-user').addEventListener('click', function () {
    if (!editingUserId) return;
    updateUser(editingUserId, document.getElementById('edit-user-name').value, selectedEditAvatar);
    editingUserId = null;
    document.getElementById('edit-user-panel').style.display = 'none';
    document.getElementById('new-user-panel').style.display = 'block';
    renderUserList();
    showToast('Profile updated', 'success');
  });

  document.getElementById('btn-cancel-edit-user').addEventListener('click', function () {
    editingUserId = null;
    document.getElementById('edit-user-panel').style.display = 'none';
    document.getElementById('new-user-panel').style.display = 'block';
  });

  document.getElementById('users-close').addEventListener('click', function () {
    document.getElementById('users-modal').close();
  });

  document.getElementById('input-import').addEventListener('change', function (e) {
    if (e.target.files[0]) importDataFile(e.target.files[0]);
    e.target.value = '';
  });

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  // Double-click data status to link a file for auto-save (Chrome/Edge)
  document.getElementById('data-status').addEventListener('dblclick', linkDataFile);
  document.getElementById('data-status').title = 'Double-click to link a JSON data file for auto-save';

  document.querySelectorAll('.sidebar-section-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.matchMedia('(min-width: 901px)').matches) return;
      var section = btn.closest('.sidebar-collapsible');
      var isOpen = section.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  window.addEventListener('resize', function () {
    if (window.matchMedia('(min-width: 901px)').matches) {
      document.querySelectorAll('.sidebar-collapsible').forEach(function (section) {
        section.classList.remove('is-open');
        var btn = section.querySelector('.sidebar-section-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // ─── Boot ─────────────────────────────────────────────────────────

  requestAnimationFrame(initData);
})();
