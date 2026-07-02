// ==========================================
// CONFIGURATION
// ==========================================
const API_BASE = "https://jqobu1e2g5.execute-api.us-east-1.amazonaws.com"; // e.g., https://abc123.execute-api.us-east-1.amazonaws.com

// ==========================================
// PAGINATION STATE
// ==========================================
let telemetryNextKey = null;
let isLoadingMore = false;

// ==========================================
// AUTO‑REFRESH STATE
// ==========================================
let autoRefreshInterval = null;      // holds the setInterval ID
const AUTO_REFRESH_MS = 2 * 60 * 1000; // 2 minutes

// ==========================================
// FETCH & RENDER
// ==========================================
async function refreshData() {
  const vehicleId = document.getElementById('vehicleSelect').value;

  // Reset pagination state
  telemetryNextKey = null;
  isLoadingMore = false;
  const tbody = document.querySelector('#telemetryTable tbody');
  tbody.innerHTML = '';
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  loadMoreBtn.style.display = 'none';
  loadMoreBtn.disabled = false;

  // Fetch first page of telemetry
  await fetchTelemetry(vehicleId);

  // Fetch scores (unchanged)
  try {
    const scoresResp = await fetch(`${API_BASE}/scores`);
    const scores = await scoresResp.json();
    renderScores(scores);
    updateSafestDriver(scores);
  } catch (err) {
    console.error('Scores fetch error', err);
  }

   try {
    const alertsResp = await fetch(`${API_BASE}/alerts`);
    const alerts = await alertsResp.json();
    renderAlerts(alerts);
  } catch (err) { console.error('Alerts fetch error', err); }
}

async function fetchTelemetry(vehicleId, startKey = null) {
  let url = `${API_BASE}/telemetry`;
  const params = new URLSearchParams();
  if (vehicleId) params.append('vehicleId', vehicleId);
  if (startKey) params.append('startKey', startKey);
  if (params.toString()) url += '?' + params.toString();

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const items = data.items || [];
    telemetryNextKey = data.nextKey || null;

    const tbody = document.querySelector('#telemetryTable tbody');
    items.forEach((item) => {
      const row = document.createElement('tr');
      if (item.speed > 100 || item.harshBraking) row.classList.add('violation');
      const time = new Date(item.timestamp).toLocaleTimeString();
      row.innerHTML = `
        <td>${tbody.children.length + 1}</td>
        <td>${item.vehicleId}</td>
        <td>${time}</td>
        <td>${item.speed} km/h</td>
        <td>${item.harshBraking ? '⚠️ Harsh' : 'Normal'}</td>
        <td>${item.engineTemp} °C</td>
        <td>${item.fuelLevel}%</td>
      `;
      tbody.appendChild(row);
    });

    // Load More button visibility
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (telemetryNextKey) {
      loadMoreBtn.style.display = 'inline-block';
    } else {
      loadMoreBtn.style.display = 'none';
    }

    // Update KPI cards from visible rows
    updateStatsFromDOM();
  } catch (err) {
    console.error('Telemetry fetch error', err);
  }
}

async function loadMoreTelemetry() {
  if (!telemetryNextKey || isLoadingMore) return;
  isLoadingMore = true;
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = 'Loading...';

  const vehicleId = document.getElementById('vehicleSelect').value;
  await fetchTelemetry(vehicleId, telemetryNextKey);

  isLoadingMore = false;
  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = 'Load More';
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
// KPI UPDATES (from visible rows)
// ==========================================
function updateStatsFromDOM() {
  const rows = document.querySelectorAll('#telemetryTable tbody tr');
  const vehicleSet = new Set();
  let alerts = 0;
  rows.forEach(row => {
    const cells = row.cells;
    if (cells.length > 1) {
      vehicleSet.add(cells[1].innerText);
      if (cells[4].innerText.includes('Harsh') || parseInt(cells[3]) > 100) {
        alerts++;
      }
    }
  });
  document.getElementById('totalVehicles').textContent = vehicleSet.size;
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
  toggle.checked = false;   // off by default
  clearAutoRefresh();

  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      startAutoRefresh();
    } else {
      clearAutoRefresh();
    }
  });
}

function startAutoRefresh() {
  clearAutoRefresh();   // avoid multiple intervals
  autoRefreshInterval = setInterval(refreshData, AUTO_REFRESH_MS);
  console.log('Auto‑refresh started (every 2 minutes)');
}

function clearAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    console.log('Auto‑refresh stopped');
  }
}

function renderAlerts(data) {
  const tbody = document.querySelector('#alertsTable tbody');
  tbody.innerHTML = '';
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
// INITIAL LOAD
// ==========================================
refreshData();
setupAutoRefreshToggle();