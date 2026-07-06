// ==========================================
// CONFIGURATION
// ==========================================
const API_BASE = "https://jqobu1e2g5.execute-api.us-east-1.amazonaws.com"; // e.g., https://abc123.execute-api.us-east-1.amazonaws.com

// ==========================================
// PAGINATION STATE
// ==========================================
let telemetryNextKey = null;
let isLoadingMore = false;
let allTelemetryLoaded = false;

// ==========================================
// CLIENT‑SIDE SORTING
// ==========================================
let allTelemetryData = [];                // full dataset loaded so far
let currentSort = { column: null, direction: 'asc' };  // 'asc' or 'desc'

// ==========================================
// AUTO‑REFRESH STATE
// ==========================================
let autoRefreshInterval = null;
const AUTO_REFRESH_MS = 2 * 60 * 1000;

// ==========================================
// AUTH HELPER (from auth.js)
// ==========================================
function getAuthHeaders() {
  const tokens = getStoredTokens();
  if (!tokens.idToken) throw new Error('No ID token');
  return {
    'Authorization': `Bearer ${tokens.idToken}`,
    'Content-Type': 'application/json'
  };
}

// ==========================================
// FETCH TELEMETRY (pagination)
// ==========================================
async function fetchTelemetry(vehicleId, startKey = null) {
  if (allTelemetryLoaded || isLoadingMore) return;

  let url = `${API_BASE}/telemetry`;
  const params = new URLSearchParams();
  if (vehicleId) params.append('vehicleId', vehicleId);
  if (startKey) params.append('startKey', startKey);
  if (params.toString()) url += '?' + params.toString();

  isLoadingMore = true;
  try {
    const resp = await fetch(url, { headers: getAuthHeaders() });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const items = data.items || [];
    telemetryNextKey = data.nextKey || null;
    if (!telemetryNextKey) allTelemetryLoaded = true;

    // Add new items to the master array (avoid duplicates by id)
    items.forEach(item => {
      if (!allTelemetryData.some(existing => existing.id === item.id)) {
        allTelemetryData.push(item);
      }
    });

    // Re-sort if a sort order is active, then render
    if (currentSort.column) {
      sortData(currentSort.column, currentSort.direction);
    } else {
      renderTelemetry(allTelemetryData);
    }

    updateStatsFromDOM();
  } catch (err) {
    console.error('Telemetry fetch error', err);
  } finally {
    isLoadingMore = false;
  }
}

// ==========================================
// RENDER TELEMETRY (replaces table body)
// ==========================================
function renderTelemetry(data) {
  const tbody = document.querySelector('#telemetryTable tbody');
  tbody.innerHTML = '';
  data.forEach((item, index) => {
    const row = document.createElement('tr');
    if (item.speed > 100 || item.harshBraking) row.classList.add('violation');
    const time = new Date(item.timestamp).toLocaleTimeString();
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.vehicleId}</td>
      <td>${time}</td>
      <td>${item.speed} km/h</td>
      <td>${item.harshBraking ? '⚠️ Harsh' : 'Normal'}</td>
      <td>${item.engineTemp} °C</td>
      <td>${item.fuelLevel}%</td>
    `;
    tbody.appendChild(row);
  });
}

// ==========================================
// SORTING LOGIC
// ==========================================
function sortData(column, direction) {
  const sorted = [...allTelemetryData].sort((a, b) => {
    let valA, valB;
    if (column === 'vehicleId') {
      valA = a.vehicleId;
      valB = b.vehicleId;
      return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (column === 'timestamp') {
      valA = a.timestamp;
      valB = b.timestamp;
      return direction === 'asc' ? valA - valB : valB - valA;
    } else if (column === 'speed') {
      valA = a.speed;
      valB = b.speed;
      return direction === 'asc' ? valA - valB : valB - valA;
    }
    return 0;
  });
  currentSort = { column, direction };
  renderTelemetry(sorted);
  updateSortIndicators(); 
}

function updateSortIndicators() {
  const headers = document.querySelectorAll('#telemetryTable thead th[data-sort]');
  headers.forEach(th => {
    const column = th.getAttribute('data-sort');
    // Remove any existing arrow from the text
    let baseText = th.textContent.replace(/ [▲▼]$/, '');
    if (column === currentSort.column) {
      const arrow = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
      th.textContent = baseText + arrow;
    } else {
      th.textContent = baseText;   // no arrow
    }
  });
}

function toggleSort(column) {
  if (currentSort.column === column) {
    // Reverse direction
    const newDir = currentSort.direction === 'asc' ? 'desc' : 'asc';
    sortData(column, newDir);
  } else {
    // Default to ascending for a new column
    sortData(column, 'asc');
  }
}

// ==========================================
// SETUP SORTING EVENT LISTENERS
// ==========================================
function setupSorting() {
  const headers = document.querySelectorAll('#telemetryTable thead th[data-sort]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-sort');
      toggleSort(column);
    });
  });
}

// ==========================================
// VEHICLES (dynamic dropdown & count)
// ==========================================
async function loadVehicles() {
  try {
    const resp = await fetch(`${API_BASE}/vehicles`, { headers: getAuthHeaders() });
    const data = await resp.json();
    const vehicleSelect = document.getElementById('vehicleSelect');
    vehicleSelect.innerHTML = '<option value="">All Vehicles</option>';
    data.vehicles.forEach(vid => {
      const opt = document.createElement('option');
      opt.value = vid;
      opt.textContent = vid;
      vehicleSelect.appendChild(opt);
    });
    document.getElementById('totalVehicles').textContent = data.count;
  } catch (err) {
    console.error('Failed to load vehicles', err);
  }
}

// ==========================================
// INFINITE SCROLL HANDLER
// ==========================================
function setupInfiniteScroll() {
  const container = document.getElementById('telemetryContainer');
  if (!container) return;
  container.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (!allTelemetryLoaded && !isLoadingMore) {
        const vehicleId = document.getElementById('vehicleSelect').value;
        fetchTelemetry(vehicleId, telemetryNextKey);
      }
    }
  });
}

// ==========================================
// REFRESH DATA (manual or auto)
// ==========================================
async function refreshData(reset = true) {
  const vehicleId = document.getElementById('vehicleSelect').value;

  if (reset) {
    telemetryNextKey = null;
    allTelemetryLoaded = false;
    isLoadingMore = false;
    allTelemetryData = [];               // clear cached telemetry
    currentSort = { column: null, direction: 'asc' };
    document.querySelector('#telemetryTable tbody').innerHTML = '';
    // Fetch vehicles again to refresh KPI
    await loadVehicles();
  }

  await fetchTelemetry(vehicleId);

  // Scores and alerts only on full reset
  if (reset) {
    try {
      const scoresResp = await fetch(`${API_BASE}/scores`, { headers: getAuthHeaders() });
      const scores = await scoresResp.json();
      renderScores(scores);
      updateSafestDriver(scores);
    } catch (err) { console.error('Scores fetch error', err); }

    try {
      const alertsResp = await fetch(`${API_BASE}/alerts`, { headers: getAuthHeaders() });
      const alerts = await alertsResp.json();
      renderAlerts(alerts);
    } catch (err) { console.error('Alerts fetch error', err); }
  }
}

// ==========================================
// RENDER SCORES
// ==========================================
function renderScores(data) {
  const tbody = document.querySelector('#scoresTable tbody');
  tbody.innerHTML = '';
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No scores yet</td></tr>';
    return;
  }
  data.forEach((item, index) => {
    const row = document.createElement('tr');
    let scoreClass = 'score-low';
    if (item.score >= 80) scoreClass = 'score-high';
    else if (item.score >= 50) scoreClass = 'score-medium';
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.vehicleId}</td>
      <td>${item.summaryDate}</td>
      <td class="${scoreClass}">${item.score}</td>
      <td>${item.summary || '—'}</td>
    `;
    tbody.appendChild(row);
  });
}

// ==========================================
// RENDER ALERTS
// ==========================================
function renderAlerts(data) {
  const tbody = document.querySelector('#alertsTable tbody');
  tbody.innerHTML = '';
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No alerts</td></tr>';
    return;
  }
  data.forEach((item, index) => {
    const row = document.createElement('tr');
    const time = new Date(item.timestamp).toLocaleTimeString();
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.vehicleId}</td>
      <td>${time}</td>
      <td>${item.violations.join(', ')}</td>
    `;
    tbody.appendChild(row);
  });
}

// ==========================================
// KPI UPDATES
// ==========================================
function updateStatsFromDOM() {
  const rows = document.querySelectorAll('#telemetryTable tbody tr');
  let alerts = 0;
  rows.forEach(row => {
    const cells = row.cells;
    if (cells.length > 1) {
      if (cells[4].innerText.includes('Harsh') || parseInt(cells[3]) > 100) alerts++;
    }
  });
  document.getElementById('totalEvents').textContent = rows.length;
  document.getElementById('alertsCount').textContent = alerts;
}

function updateSafestDriver(scores) {
  if (!scores.length) {
    document.getElementById('mostSafeDriver').textContent = '—';
    return;
  }
  const safest = scores.reduce((prev, curr) => (prev.score > curr.score ? prev : curr));
  document.getElementById('mostSafeDriver').textContent = `${safest.vehicleId} (${safest.score})`;
}

// ==========================================
// AUTO‑REFRESH TOGGLE
// ==========================================
function setupAutoRefreshToggle() {
  const toggle = document.getElementById('autoRefreshToggle');
  toggle.checked = false;
  clearAutoRefresh();
  toggle.addEventListener('change', () => {
    if (toggle.checked) startAutoRefresh();
    else clearAutoRefresh();
  });
}
function startAutoRefresh() {
  clearAutoRefresh();
  autoRefreshInterval = setInterval(() => refreshData(true), AUTO_REFRESH_MS);
}
function clearAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// ==========================================
// MAIN INITIALISATION
// ==========================================
async function init() {
  if (window.location.search.includes('code=')) {
    const success = await handleAuthCallback();
    if (success) {
      window.location.href = REDIRECT_URI;
      return;
    } else {
      alert('Login failed. Please try again.');
      return;
    }
  }
  if (!isTokenValid()) {
    login();
    return;
  }
  try {
    if (getStoredTokens().expiry && Date.now() > getStoredTokens().expiry - 120000) {
      await refreshAccessToken();
    }
  } catch (err) { console.warn('Token refresh failed'); }

  startDashboard();
}

function startDashboard() {
  setupInfiniteScroll();
  setupSorting();                        // new
  const refreshBtn = document.querySelector('.refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => refreshData(true));
  const vehicleSelect = document.getElementById('vehicleSelect');
  if (vehicleSelect) vehicleSelect.addEventListener('change', () => refreshData(true));
  setupAutoRefreshToggle();
  refreshData(true);
}

window.logout = logout;
init();