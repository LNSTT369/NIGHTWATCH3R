import type { Env } from "../env.d";
import { createD1Client } from "../storage/d1/client";
import { encryptText } from "../lib/utils";

export async function handlePortalGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  if (request.method === "POST") {
    // API Credentials Setup
    try {
      const body = await request.json() as {
        token: string;
        alpaca_api_key: string;
        alpaca_api_secret: string;
        alpaca_paper: boolean;
      };
      
      const { token, alpaca_api_key, alpaca_api_secret, alpaca_paper } = body;
      if (!token || !alpaca_api_key || !alpaca_api_secret) {
        return new Response(JSON.stringify({ ok: false, error: "MISSING_FIELDS", message: "All fields are required." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      const db = createD1Client(env.DB);
      const row = await db.executeOne<{ key_id: string }>(
        "SELECT key_id FROM api_keys WHERE token_hash = ? AND (revoked = 0 OR revoked IS NULL)",
        [token]
      );
      
      if (!row) {
        return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED", message: "Invalid or revoked Developer Key." }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Encrypt Alpaca keys using KILL_SWITCH_SECRET as the shared GCM key
      const secretKey = env.KILL_SWITCH_SECRET || "default-fallback-super-secret-key-123456";
      const encryptedKey = await encryptText(alpaca_api_key, secretKey);
      const encryptedSecret = await encryptText(alpaca_api_secret, secretKey);
      const paperVal = alpaca_paper ? 1 : 0;
      
      await db.run(
        `UPDATE api_keys 
         SET alpaca_api_key = ?, alpaca_api_secret = ?, alpaca_paper = ?
         WHERE key_id = ?`,
        [encryptedKey, encryptedSecret, paperVal, row.key_id]
      );
      
      return new Response(JSON.stringify({ ok: true, message: "Alpaca trading credentials configured successfully." }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
      
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: "INTERNAL_ERROR", message: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NIGHTWATCHER V3 — SETUP</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  
  <style>
    :root {
      --bg: #ffffff;
      --text: #000000;
      --border: #000000;
      --muted: #666666;
      --success: #10b981;
      --error: #dc2626;
      --warning: #d97706;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: #f5f5f5;
      color: var(--text);
      font-family: var(--font-mono);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 2rem;
    }

    .setup-frame {
      width: 100%;
      max-width: 750px;
      border: 4px solid var(--border);
      padding: 2.5rem;
      background: white;
      box-shadow: 12px 12px 0px rgba(0,0,0,0.1);
      position: relative;
    }

    .setup-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 1.4rem;
      margin-bottom: 2.5rem;
    }

    .header-dots {
      flex-grow: 1;
      border-bottom: 4px dotted #ccc;
      height: 0.8rem;
    }

    .step-container { display: none; flex-direction: column; gap: 2rem; }
    .step-container.active { display: flex; }

    h2 { font-size: 2.8rem; text-align: center; margin-top: 1rem; font-weight: 700; letter-spacing: -1px; }
    .subtitle { text-align: center; font-size: 1.2rem; color: #000; font-weight: 500; margin-top: -1rem; }
    .muted-text { text-align: center; color: #888; font-size: 0.9rem; margin-top: -1rem; }

    .feature-list { list-style: none; display: flex; flex-direction: column; gap: 1.5rem; margin: 2rem 0; }
    .feature-item { display: flex; gap: 1.5rem; align-items: flex-start; font-size: 1.05rem; line-height: 1.5; font-weight: 500; }
    .feature-number { color: var(--success); font-weight: bold; min-width: 25px; }

    .disclaimer-title { font-size: 2.2rem; color: var(--warning); text-align: center; margin-bottom: 0.5rem; font-weight: 500; }
    .disclaimer-box {
      border: 1px solid #000;
      padding: 1.5rem;
      max-height: 350px;
      overflow-y: auto;
      line-height: 1.6;
      font-size: 0.95rem;
      color: #555;
    }
    .disclaimer-box b { color: #000; }
    .disclaimer-box li { margin-bottom: 0.8rem; position: relative; padding-left: 1.5rem; list-style: none; }
    .disclaimer-box li::before { content: '•'; position: absolute; left: 0; color: #000; font-weight: bold; }

    .checkbox-container {
      display: flex;
      gap: 1.2rem;
      align-items: flex-start;
      font-weight: 500;
      cursor: pointer;
      margin-top: 1.5rem;
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .custom-checkbox {
      width: 32px;
      height: 32px;
      border: 4px solid var(--border);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 1.5rem;
    }
    #agreeDisclaimer:checked + .custom-checkbox::after { content: 'X'; position: absolute; }

    .form-group { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.8rem; }
    .form-label { font-weight: bold; text-transform: uppercase; font-size: 1rem; }
    .form-input { border: 3px solid var(--border); padding: 1rem; font-family: var(--font-mono); font-size: 1.1rem; width: 100%; outline: none; }
    .form-input:focus { background: #fafafa; }

    .btn {
      border: 4px solid var(--border);
      background: #fff;
      color: var(--text);
      padding: 1.2rem;
      font-family: var(--font-mono);
      font-weight: bold;
      font-size: 1.3rem;
      text-transform: uppercase;
      cursor: pointer;
      text-align: center;
    }
    .btn:hover { background: #000; color: #fff; }
    .btn:disabled { color: #bbb; border-color: #eee; cursor: not-allowed; }
    .btn-row { display: grid; grid-template-columns: 1fr 1.5fr; gap: 1rem; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 2rem; }

    /* DASHBOARD */
    .dashboard-container { display: none; width: 100%; max-width: 1300px; gap: 2rem; }
    .dashboard-container.active { display: flex; }
    .panel { border: 4px solid var(--border); padding: 2rem; background: white; box-shadow: 8px 8px 0px rgba(0,0,0,0.05); }
    .panel-header { font-weight: bold; text-transform: uppercase; border-bottom: 3px solid var(--border); padding-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .badge { font-size: 0.85rem; padding: 0.3rem 0.7rem; border: 2px solid var(--border); font-weight: bold; }
    .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin: 1rem 0; }
    .score-box { border: 2px solid var(--border); padding: 1.5rem; text-align: center; }
    .console { background: #000; color: #0f0; padding: 1.2rem; font-size: 0.9rem; height: 350px; overflow-y: auto; border: 4px solid var(--border); line-height: 1.4; }
    
    footer { margin-top: 4rem; font-size: 0.8rem; font-weight: bold; color: #888; text-align: center; letter-spacing: 1px; }

    @media (max-width: 1000px) { .dashboard-container { flex-direction: column; } }
  </style>
</head>
<body>

  <!-- ONBOARDING -->
  <div id="onboarding" class="setup-frame">
    <div class="setup-header">
      <span>NIGHTWATCHER SETUP</span>
      <div class="header-dots"></div>
    </div>

    <!-- STEP 1: INTRO -->
    <div id="step-intro" class="step-container active">
      <h2>NIGHTWATCHER V3</h2>
      <p class="subtitle">Universal execution layer for autonomous trading</p>
      <p class="muted-text">Any strategy · Any language · One signal call.</p>

      <ul class="feature-list">
        <li class="feature-item"><span class="feature-number">1.</span><span>Universal open API accepting signals via REST, WebSocket, or MCP</span></li>
        <li class="feature-item"><span class="feature-number">2.</span><span>Deterministic pre-trade Policy Engine enforcing strict risk controls</span></li>
        <li class="feature-item"><span class="feature-number">3.</span><span>Institutional-grade quantitative limits: Kelly sizing, portfolio VaR, & Pearson concentration clamps</span></li>
        <li class="feature-item"><span class="feature-number">4.</span><span>Secure two-step HMAC-signed token approval with complete D1 audit logging</span></li>
      </ul>

      <button class="btn" onclick="nextStep('disclaimer')">GET STARTED</button>
    </div>

    <!-- STEP 2: DISCLAIMER -->
    <div id="step-disclaimer" class="step-container">
      <div class="disclaimer-title">Risk Disclaimer</div>
      <p style="text-align: center; color: #666; margin-top: -1.5rem;">Please read carefully before proceeding</p>

      <div class="disclaimer-box">
        <p>This software is provided for <b>educational and informational purposes only</b>. Nothing in this software constitutes financial, investment, legal, or tax advice.</p>
        <br>
        <p><b>By using this software, you acknowledge and agree that:</b></p>
        <ul>
          <li>All trading and investment decisions are made <span style="color: var(--warning); font-weight: bold;">at your own risk</span></li>
          <li>Markets are volatile and <span style="color: var(--error); font-weight: bold;">you can lose some or all of your capital</span></li>
          <li>No guarantees of performance, profits, or outcomes are made</li>
          <li>The authors, contributors, and maintainers are not responsible for any financial losses</li>
          <li>You are solely responsible for your own trades and investment decisions</li>
          <li>This software may contain bugs, errors, or behave unexpectedly</li>
          <li>Past performance does not guarantee future results</li>
        </ul>
      </div>

      <label class="checkbox-container">
        <input type="checkbox" id="agreeDisclaimer" style="display:none;" onchange="toggleDisclaimerBtn()">
        <div class="custom-checkbox"></div>
        <span>I have read and understand the risks. I accept full responsibility for any losses that may occur from using this software.</span>
      </label>

      <button id="disclaimerBtn" class="btn" disabled style="margin-top: 1rem;" onclick="nextStep('auth')">I UNDERSTAND, CONTINUE</button>
    </div>

    <!-- STEP 3: DEVELOPER AUTH -->
    <div id="step-auth" class="step-container">
      <h2>AUTHENTICATION</h2>
      <p class="subtitle">Secure your execution tenancy</p>

      <div class="form-group">
        <label class="form-label">Developer Key</label>
        <input type="password" id="devKeyInput" class="form-input" placeholder="Paste your Developer Key (e.g. dev-key-hash-stub)...">
        <p style="font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem;">This key isolates your strategies and credentials in the D1 database.</p>
      </div>

      <div class="btn-row">
        <button class="btn" style="border-width: 2px;" onclick="nextStep('disclaimer')">BACK</button>
        <button class="btn" onclick="validateDevKey()">CONTINUE</button>
      </div>
    </div>

    <!-- STEP 4: CONFIGURATION -->
    <div id="step-config" class="step-container">
      <div class="setup-header" style="font-size: 1.1rem; margin-top: -1rem; border: none; margin-bottom: 0.5rem;">
        <span>ALPACA TRADING ACCOUNT</span>
      </div>
      <p style="font-size: 0.9rem; color: var(--muted); margin-bottom: 1.5rem;">Get your API keys from app.alpaca.markets</p>

      <form id="setupForm">
        <div class="form-group">
          <label class="form-label">API KEY</label>
          <input type="text" id="alpaca_api_key" class="form-input" placeholder="PK..." required>
        </div>
        <div class="form-group">
          <label class="form-label">API SECRET</label>
          <input type="password" id="alpaca_api_secret" class="form-input" placeholder="Secret key..." required>
        </div>

        <label class="checkbox-container" style="margin-bottom: 1.5rem;">
          <input type="checkbox" id="alpaca_paper" checked style="display:none;">
          <div class="custom-checkbox"></div>
          <span>PAPER TRADING MODE (RECOMMENDED FOR TESTING)</span>
        </label>

        <div class="form-group">
          <label class="form-label">OPENAI API KEY (OPTIONAL)</label>
          <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem;">Required for AI-powered analysis. Get from platform.openai.com</p>
          <input type="password" id="openai_api_key" class="form-input" placeholder="sk-...">
        </div>

        <div class="form-group">
          <label class="form-label">STARTING EQUITY</label>
          <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem;">Your account starting balance (for P&L tracking)</p>
          <input type="number" id="starting_equity" class="form-input" value="100000">
        </div>

        <div class="btn-row">
          <button type="button" class="btn" style="border-width: 2px;" onclick="nextStep('auth')">BACK</button>
          <button type="submit" class="btn">SAVE & CONTINUE</button>
        </div>
      </form>
    </div>
  </div>

  <!-- DASHBOARD -->
  <div id="dashboard" class="dashboard-container">
    
    <!-- Left -->
    <div style="flex: 1.3; display: flex; flex-direction: column; gap: 2rem;">
      <div class="panel">
        <div class="panel-header">
          <span>ALPHA SOCKET // REPO INGESTION</span>
          <span id="repoStatusBadge" class="badge">STATUS: IDLE</span>
        </div>
        
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">GITHUB REPO URL</label>
          <div style="display: flex; gap: 1rem;">
            <input type="url" id="githubUrl" class="form-input" placeholder="https://github.com/owner/repo" required style="flex-grow: 1;">
            <button type="button" id="analyzeBtn" class="btn" style="padding: 0.5rem 1.5rem; font-size: 1rem;">[ ANALYZE ]</button>
            <button type="button" id="clearBtn" class="btn" style="padding: 0.5rem 1.5rem; font-size: 1rem;">[ CLEAR ]</button>
          </div>
        </div>
        <div style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">
          // paste research-to-code repos for policy-gated deployment
        </div>

        <div style="margin-top: 1.5rem;">
          <div style="font-size: 0.8rem; font-weight: bold; margin-bottom: 0.5rem; text-transform: uppercase;">PIPELINE LOG // EVENTS</div>
          <div id="repoLogArea" style="height: 180px; overflow-y: scroll; border: 2px solid var(--border); padding: 1rem; font-family: var(--font-mono); font-size: 0.85rem; line-height: 1.4;">
            <div style="color: #888;">-- NO ACTIVE REPO TASK --<br>// waiting for github url</div>
          </div>
        </div>

        <div id="strategySummaryRow" style="display: none; border-top: 2px solid var(--border); padding-top: 1rem; margin-top: 1.5rem;">
          <div style="font-weight: bold; margin-bottom: 0.3rem;">PRIMARY STRATEGY: <span id="summaryName">--</span></div>
          <div style="font-size: 0.85rem; color: #444;">
            HASH: <span id="summaryHash">--</span> &nbsp;&nbsp; REGIME: <span id="summaryRegime">--</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span>SYSTEMATIC LITERATURE VALIDATOR</span>
          <span id="validatorBadge" class="badge">IDLE</span>
        </div>
        <div class="score-grid">
          <div class="score-box">
            <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">SHARPE</div>
            <div id="valSharpe" style="font-size: 1.8rem; font-weight: bold;">--</div>
          </div>
          <div class="score-box">
            <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">DRAWDOWN</div>
            <div id="valDrawdown" style="font-size: 1.8rem; font-weight: bold;">--</div>
          </div>
          <div class="score-box">
            <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">GATE STATUS</div>
            <div id="valStatus" style="font-size: 1.2rem; font-weight: bold;">PENDING</div>
          </div>
        </div>
      </div>

      <div class="panel" style="flex-grow: 1;">
        <div class="panel-header">REAL-TIME LOGS</div>
        <div id="consoleFeed" class="console">
          <div class="console-line">Neural mesh active. Ready for GitHub ingestion...</div>
        </div>
      </div>
    </div>

    <!-- Right -->
    <div style="flex: 1; display: flex; flex-direction: column; gap: 2rem;">
      <div class="panel">
        <div class="panel-header">
          <span>EQUITY CURVE</span>
          <span id="equityValue" class="badge">--</span>
        </div>
        <div style="height: 350px;">
          <canvas id="equityChart"></canvas>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span>TENANCY</span>
          <button class="badge" onclick="resetSetup()" style="cursor:pointer; background:white;">RESET</button>
        </div>
        <p id="activeAccountLabel" style="font-size: 1rem; margin-bottom: 1rem;">ID: <span style="font-weight: bold;">--</span></p>
        <div style="display:flex; align-items:center; gap:0.8rem; font-size:0.9rem; font-weight: bold;">
          <div id="socketIndicator" style="width:12px; height:12px; border:3px solid #000; background: #fff;"></div>
          <span id="socketStatus">DISCONNECTED</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">ACTIVE STRATEGIES</div>
        <div id="strategyList" style="font-size: 0.85rem;">
          <p style="color: var(--muted);">Loading strategies...</p>
        </div>
      </div>

      <div class="panel" style="flex-grow: 1;">
        <div class="panel-header">PIPELINE STAGES</div>
        <ul style="font-size: 0.9rem; line-height: 2; padding-left: 1rem; font-weight: 500;">
          <li>1. GIT INGESTION <span style="color:var(--success)">✓</span></li>
          <li>2. V8 COMPILATION <span style="color:var(--success)">✓</span></li>
          <li>3. HISTORICAL SIMULATION <span style="color:var(--success)">✓</span></li>
          <li>4. POLICY GATE AUDIT <span style="color:var(--success)">✓</span></li>
          <li>5. ALPACA ROUTING <span style="color:var(--success)">✓</span></li>
        </ul>
      </div>
    </div>

  </div>

  <footer>
    NIGHTWATCHER V3 // UNIVERSAL EXECUTION RAIL // (C) 2026 QUANT CODE AUTOMATA
  </footer>

  <script>
    let currentDevKey = "";
    let ws = null;
    let equityChart = null;

    function nextStep(stepId) {
      document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
      document.getElementById('step-' + stepId).classList.add('active');
      window.scrollTo(0, 0);
    }

    function toggleDisclaimerBtn() {
      document.getElementById('disclaimerBtn').disabled = !document.getElementById('agreeDisclaimer').checked;
    }

    function validateDevKey() {
      const key = document.getElementById('devKeyInput').value.trim();
      if (!key) return alert("Please enter your Developer Key.");
      currentDevKey = key;
      localStorage.setItem('nightwatcher_dev_key', key);
      nextStep('config');
    }

    function resetSetup() {
      if (confirm("Reset everything?")) { localStorage.clear(); location.reload(); }
    }

    document.getElementById('setupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const alpaca_api_key = document.getElementById('alpaca_api_key').value.trim();
      const alpaca_api_secret = document.getElementById('alpaca_api_secret').value.trim();
      const alpaca_paper = document.getElementById('alpaca_paper').checked;
      
      try {
        const res = await fetch("/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: currentDevKey, alpaca_api_key, alpaca_api_secret, alpaca_paper })
        });
        
        if (res.ok) { localStorage.setItem('nightwatcher_setup_done', 'true'); showDashboard(); }
        else { alert("Error: " + (await res.json()).message); }
      } catch (err) { alert("Network failure: " + err.message); }
    });

    function showDashboard() {
      document.getElementById('onboarding').style.display = 'none';
      document.getElementById('dashboard').classList.add('active');
      document.getElementById('activeAccountLabel').querySelector('span').textContent = currentDevKey;
      connectWebSocket();
      initEquityChart();
      updateEquityCurve();
      updateStrategyList();
      setInterval(updateEquityCurve, 30000);
      setInterval(updateStrategyList, 60000);
    }

    async function updateStrategyList() {
      try {
        const res = await fetch("/api/strategies/list", {
          headers: { "Authorization": \`Bearer \${currentDevKey}\` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const container = document.getElementById('strategyList');
        if (data.strategies && data.strategies.length > 0) {
          container.innerHTML = data.strategies.map(s => \`
            <div style="padding: 0.8rem; border: 1px solid #eee; margin-bottom: 0.8rem;">
              <div style="font-weight: bold; margin-bottom: 0.3rem;">\${s.name.toUpperCase()}</div>
              <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.5rem; word-break: break-all;">\${s.github_url}</div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="badge" style="background: #000; color: #fff; font-size: 0.7rem;">SHARPE: \${s.last_backtest_sharpe?.toFixed(2) || 'N/A'}</span>
                <span style="font-size: 0.7rem; color: #10b981; font-weight: bold;">\${s.status.toUpperCase()}</span>
              </div>
            </div>
          \`).join('');
        } else {
          container.innerHTML = '<p style="color: var(--muted);">No active strategies deployed.</p>';
        }
      } catch (err) { console.error("Strategy list fail:", err); }
    }

    function logConsole(message, type = "") {
      const feed = document.getElementById('consoleFeed');
      const line = document.createElement('div');
      line.className = 'console-line';
      const time = new Date().toTimeString().split(' ')[0];
      line.textContent = \`[\${time}] \${message}\`;
      if (type === "success") line.style.color = "#0f0";
      if (type === "error") line.style.color = "#f00";
      feed.appendChild(line);
      feed.scrollTop = feed.scrollHeight;
    }

    function connectWebSocket() {
      if (ws) ws.close();
      const wsUrl = \`\${location.protocol === "https:" ? "wss" : "ws"}://\${location.host}/stream?key=\${encodeURIComponent(currentDevKey)}\`;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          logConsole("WebSocket rail connected.", "success");
          document.getElementById('socketStatus').textContent = "RAIL ACTIVE";
          document.getElementById('socketIndicator').style.background = "#0f0";
          ws.send(JSON.stringify({ type: "subscribe", symbols: ["*"] }));
        };
        ws.onmessage = (e) => logConsole("INBOUND: " + e.data);
        ws.onerror = () => logConsole("WebSocket rail failure.", "error");
        ws.onclose = () => {
          document.getElementById('socketStatus').textContent = "RAIL OFFLINE";
          document.getElementById('socketIndicator').style.background = "#fff";
        };
      } catch (err) { logConsole("Rail Init Fail: " + err.message, "error"); }
    }

    function initEquityChart() {
      const ctx = document.getElementById('equityChart').getContext('2d');
      equityChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Equity', data: [], borderColor: '#000', borderWidth: 4, tension: 0, fill: false, pointRadius: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { grid: { color: '#ddd', lineWidth: 1 }, ticks: { font: { family: 'JetBrains Mono', weight: 'bold' } } }
          }
        }
      });
    }

    async function updateEquityCurve() {
      try {
        const res = await fetch("/api/portfolio-history?period=1D&timeframe=5Min", {
          headers: { "Authorization": \`Bearer \${currentDevKey}\` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.equity) return;
        document.getElementById('equityValue').textContent = '$' + data.equity[data.equity.length - 1].toLocaleString();
        equityChart.data.labels = data.timestamp.map(ts => "");
        equityChart.data.datasets[0].data = data.equity;
        equityChart.update();
      } catch (err) {}
    }

    function updateRepoLog(logs) {
      const area = document.getElementById('repoLogArea');
      if (logs.length === 0) {
        area.innerHTML = '<div style="color: #888;">-- NO ACTIVE REPO TASK --<br>// waiting for github url</div>';
        return;
      }
      area.innerHTML = logs.map(l => \`
        <div style="margin-bottom: 0.2rem; white-space: pre-wrap;">
          <span style="color: #888; margin-right: 1rem;">\${l.time}</span>
          <span style="font-weight: bold; margin-right: 1rem; display: inline-block; min-width: 120px;">\${l.phase}</span>
          <span>\${l.message}</span>
        </div>
      \`).join('');
      area.scrollTop = area.scrollHeight;
    }

    let currentTaskId = null;
    let pollInterval = null;

    async function pollRepoStatus() {
      if (!currentTaskId) return;
      try {
        const res = await fetch(\`/alpha-socket/repo/status?task_id=\${currentTaskId}\`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.logs) updateRepoLog(data.logs);
        
        if (data.status === "success" && data.current_phase === "TASK_DONE") {
          clearInterval(pollInterval);
          document.getElementById('repoStatusBadge').textContent = "STATUS: READY";
          if (data.strategy) {
            document.getElementById('strategySummaryRow').style.display = 'block';
            document.getElementById('summaryName').textContent = data.strategy.name;
            document.getElementById('summaryHash').textContent = (data.strategy_hash || "").slice(0, 8);
            document.getElementById('summaryRegime').textContent = data.strategy.regime_profile;
          }
        } else if (data.status === "error") {
          clearInterval(pollInterval);
          document.getElementById('repoStatusBadge').textContent = "STATUS: BLOCKED";
        }
      } catch (err) { console.error("Poll fail:", err); }
    }

    document.getElementById('analyzeBtn').addEventListener('click', async () => {
      const githubUrl = document.getElementById('githubUrl').value.trim();
      if (!githubUrl) return alert("Please enter a GitHub URL.");
      
      const analyzeBtn = document.getElementById('analyzeBtn');
      const githubInput = document.getElementById('githubUrl');
      
      analyzeBtn.disabled = true;
      githubInput.disabled = true;
      document.getElementById('repoStatusBadge').textContent = "STATUS: RUN";
      
      const now = new Date().toTimeString().split(' ')[0];
      updateRepoLog([{ time: now, phase: "TASK_START", message: \`Initiating ingestion for \${githubUrl}...\` }]);

      try {
        const res = await fetch("/alpha-socket/repo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo_url: githubUrl })
        });
        const data = await res.json();
        
        if (res.ok && data.status === "success") {
          currentTaskId = data.task_id;
          updateRepoLog(data.log);
          
          if (data.strategy && data.strategy.name !== "Pending Analysis") {
            document.getElementById('repoStatusBadge').textContent = "STATUS: READY";
            document.getElementById('strategySummaryRow').style.display = 'block';
            document.getElementById('summaryName').textContent = data.strategy.name;
            document.getElementById('summaryHash').textContent = data.strategy.hash;
            document.getElementById('summaryRegime').textContent = data.strategy.regime;
          } else {
            pollInterval = setInterval(pollRepoStatus, 1500);
          }
        } else {
          document.getElementById('repoStatusBadge').textContent = "STATUS: BLOCKED";
          updateRepoLog([{ time: now, phase: "ERROR", message: data.message || "Unknown error" }]);
        }
      } catch (err) {
        document.getElementById('repoStatusBadge').textContent = "STATUS: BLOCKED";
        updateRepoLog([{ time: now, phase: "NETWORK_FAIL", message: err.message }]);
      } finally {
        analyzeBtn.disabled = false;
        githubInput.disabled = false;
      }
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
      document.getElementById('githubUrl').value = "";
      document.getElementById('repoStatusBadge').textContent = "STATUS: IDLE";
      document.getElementById('strategySummaryRow').style.display = 'none';
      updateRepoLog([]);
      if (pollInterval) clearInterval(pollInterval);
      currentTaskId = null;
    });

    window.addEventListener("DOMContentLoaded", () => {
      const storedKey = localStorage.getItem('nightwatcher_dev_key');
      const setupDone = localStorage.getItem('nightwatcher_setup_done');
      if (storedKey) {
        currentDevKey = storedKey;
        document.getElementById('devKeyInput').value = storedKey;
        if (setupDone) showDashboard();
        else nextStep('config');
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
