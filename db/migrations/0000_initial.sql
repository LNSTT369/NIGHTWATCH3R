-- Initial Schema for VALKYRIE

-- API Keys & Multi-tenant Config
CREATE TABLE IF NOT EXISTS api_keys (
    key_id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    credibility_weight REAL DEFAULT 1.0,
    revoked INTEGER DEFAULT 0,
    alpaca_api_key TEXT,
    alpaca_api_secret TEXT,
    alpaca_paper INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Global Risk State (Kill Switch)
CREATE TABLE IF NOT EXISTS risk_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    kill_switch_active INTEGER DEFAULT 0,
    kill_switch_reason TEXT,
    kill_switch_at DATETIME,
    daily_loss_usd REAL DEFAULT 0,
    daily_loss_reset_at DATETIME,
    last_loss_at DATETIME,
    cooldown_until DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize risk state
INSERT OR IGNORE INTO risk_state (id, kill_switch_active) VALUES (1, 0);

-- Order Approvals (Policy Gate output)
CREATE TABLE IF NOT EXISTS order_approvals (
    id TEXT PRIMARY KEY,
    preview_hash TEXT NOT NULL,
    order_params_json TEXT NOT NULL,
    policy_result_json TEXT NOT NULL,
    approval_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trades Execution Log
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    approval_id TEXT,
    alpaca_order_id TEXT UNIQUE NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty REAL NOT NULL,
    order_type TEXT NOT NULL,
    limit_price REAL,
    stop_price REAL,
    status TEXT NOT NULL,
    filled_qty REAL,
    filled_avg_price REAL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (approval_id) REFERENCES order_approvals(id)
);

-- Trade Journal (Performance Tracking)
CREATE TABLE IF NOT EXISTS trade_journal (
    id TEXT PRIMARY KEY,
    trade_id TEXT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    entry_price REAL,
    entry_at DATETIME,
    exit_price REAL,
    exit_at DATETIME,
    qty REAL NOT NULL,
    pnl_usd REAL,
    pnl_pct REAL,
    hold_duration_mins INTEGER,
    signals_json TEXT,
    technicals_json TEXT,
    regime_tags TEXT,
    event_ids TEXT,
    outcome TEXT,
    notes TEXT,
    lessons_learned TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trade_id) REFERENCES trades(id)
);

-- News & Event Ingestion
CREATE TABLE IF NOT EXISTS raw_events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    r2_key TEXT,
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, source_id)
);

CREATE TABLE IF NOT EXISTS structured_events (
    id TEXT PRIMARY KEY,
    raw_event_id TEXT,
    event_type TEXT NOT NULL,
    symbols TEXT,
    summary TEXT,
    confidence REAL,
    validated INTEGER DEFAULT 0,
    validation_errors TEXT,
    trade_proposal_id TEXT,
    trade_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (raw_event_id) REFERENCES raw_events(id)
);

CREATE TABLE IF NOT EXISTS news_items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    symbols TEXT,
    r2_key TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, source_id)
);

CREATE TABLE IF NOT EXISTS event_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    config_json TEXT,
    active INTEGER DEFAULT 1,
    last_poll_at DATETIME,
    poll_interval_mins INTEGER DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Risk Metric Snapshots
CREATE TABLE IF NOT EXISTS risk_metric_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_type TEXT NOT NULL, -- 'kelly', 'sharpe', 'var', 'correlation'
    symbol TEXT,
    symbol_b TEXT,
    kelly_fraction REAL,
    recommended_pct_equity REAL,
    win_rate REAL,
    avg_win_pct REAL,
    avg_loss_pct REAL,
    odds_ratio REAL,
    edge REAL,
    sharpe_ratio REAL,
    annualized_return_pct REAL,
    annualized_vol_pct REAL,
    n_observations INTEGER,
    var_usd REAL,
    var_pct REAL,
    cvar_usd REAL,
    cvar_pct REAL,
    confidence REAL,
    pearson_r REAL,
    is_over_threshold INTEGER,
    raw_json TEXT,
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Policy Configuration
CREATE TABLE IF NOT EXISTS policy_configs (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    config_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO policy_configs (id, config_json) VALUES (1, '{}');
