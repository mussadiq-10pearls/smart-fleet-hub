// ==========================================
// CONFIGURATION – change this to your API Gateway endpoint
// ==========================================
const API_BASE = "https://jqobu1e2g5.execute-api.us-east-1.amazonaws.com";

// ==========================================
// Data fetching & rendering
// ==========================================
async function refreshData() {
  const vehicleId = document.getElementById('vehicleSelect').value;

  // Fetch telemetry
  let telemetryUrl = `${API_BASE}/telemetry`;
  if (vehicleId) telemetryUrl += `?vehicleId=${vehicleId}`;
  try {
    const resp = await fetch(telemetryUrl);
    const telemetry = await resp.json();
    renderTelemetry(telemetry);
    updateStats(telemetry);
  } catch (err) { console.error('Telemetry fetch error', err); }

  // Fetch scores
  try {
    const scoresResp = await fetch(`${API_BASE}/scores`);
    const scores = await scoresResp.json();
    renderScores(scores);
    updateSafestDriver(scores);
  } catch (err) { console.error('Scores fetch error', err); }
}

function renderTelemetry(data) {
  const tbody = document.querySelector('#telemetryTable tbody');
  tbody.innerHTML = '';
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No telemetry data</td></tr>';
    return;
  }
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

function updateStats(telemetry) {
  const uniqueVehicles = new Set(telemetry.map(e => e.vehicleId)).size;
  document.getElementById('totalVehicles').textContent = uniqueVehicles;
  document.getElementById('totalEvents').textContent = telemetry.length;
  const alerts = telemetry.filter(e => e.speed > 100 || e.harshBraking).length;
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

// Initial load & auto-refresh every 30 seconds
refreshData();
setInterval(refreshData, 30000);