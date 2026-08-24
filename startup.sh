#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/.run/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"

BACKEND_DIR="$ROOT_DIR/Backend/InvoiceProcessing"
FRONTEND_DIR="$ROOT_DIR/Frontend"

BACKEND_PID_FILE="$RUN_DIR/backend_8201.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend_8200.pid"

BACKEND_LOG="$LOG_DIR/backend_8201.log"
FRONTEND_LOG="$LOG_DIR/frontend_8200.log"

backend_healthcheck() {
  curl -fsS "http://127.0.0.1:8201/health" >/dev/null 2>&1
}

frontend_healthcheck() {
  curl -fsS "http://127.0.0.1:8200/" >/dev/null 2>&1
}

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

port_pids() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

kill_port_listeners() {
  local port="$1"
  local name="$2"
  local pids
  pids="$(port_pids "$port")"
  if [[ -z "${pids:-}" ]]; then
    return 0
  fi

  echo "$name port $port is occupied. Stopping existing listener(s): $pids"
  while IFS= read -r pid; do
    [[ -z "${pid:-}" ]] && continue
    kill "$pid" >/dev/null 2>&1 || true
  done <<<"$pids"

  sleep 1

  local remaining
  remaining="$(port_pids "$port")"
  if [[ -n "${remaining:-}" ]]; then
    while IFS= read -r pid; do
      [[ -z "${pid:-}" ]] && continue
      kill -9 "$pid" >/dev/null 2>&1 || true
    done <<<"$remaining"
  fi
}

read_pid() {
  local file="$1"
  if [[ -f "$file" ]]; then
    cat "$file"
  fi
}

start_backend() {
  local existing_pid
  existing_pid="$(read_pid "$BACKEND_PID_FILE" || true)"
  if [[ -n "${existing_pid:-}" ]] && is_running "$existing_pid"; then
    echo "Backend pid exists (pid=$existing_pid). Restarting..."
    kill "$existing_pid" >/dev/null 2>&1 || true
    sleep 1
    if is_running "$existing_pid"; then
      kill -9 "$existing_pid" >/dev/null 2>&1 || true
    fi
    rm -f "$BACKEND_PID_FILE"
  fi

  if backend_healthcheck; then
    echo "Backend detected by health check on port 8201. Restarting..."
  fi

  if [[ ! -d "$BACKEND_DIR" ]]; then
    echo "Backend directory not found: $BACKEND_DIR"
    return 1
  fi

  kill_port_listeners 8201 "Backend"

  echo "Starting backend on http://127.0.0.1:8201 ..."
  (
    cd "$BACKEND_DIR"
    nohup uvicorn app:app --host 127.0.0.1 --port 8201 >"$BACKEND_LOG" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )
  sleep 2

  local pid
  pid="$(read_pid "$BACKEND_PID_FILE")"
  if [[ -n "$pid" ]] && is_running "$pid"; then
    echo "Backend started (pid=$pid)"
    return 0
  fi

  echo "Backend failed to start. Check log: $BACKEND_LOG"
  return 1
}

start_frontend() {
  local existing_pid
  existing_pid="$(read_pid "$FRONTEND_PID_FILE" || true)"
  if [[ -n "${existing_pid:-}" ]] && is_running "$existing_pid"; then
    echo "Frontend pid exists (pid=$existing_pid). Restarting..."
    kill "$existing_pid" >/dev/null 2>&1 || true
    sleep 1
    if is_running "$existing_pid"; then
      kill -9 "$existing_pid" >/dev/null 2>&1 || true
    fi
    rm -f "$FRONTEND_PID_FILE"
  fi

  if frontend_healthcheck; then
    echo "Frontend detected by health check on port 8200. Restarting..."
  fi

  if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo "Frontend directory not found: $FRONTEND_DIR"
    return 1
  fi

  kill_port_listeners 8200 "Frontend"

  local pkg="$FRONTEND_DIR/package.json"
  if [[ ! -f "$pkg" ]]; then
    echo "Frontend skipped: package.json not found in $FRONTEND_DIR"
    return 0
  fi

  local node_modules="$FRONTEND_DIR/node_modules"
  if [[ ! -d "$node_modules" ]]; then
    echo "Installing frontend dependencies ..."
    (cd "$FRONTEND_DIR" && npm install >>"$FRONTEND_LOG" 2>&1)
  fi

  echo "Starting frontend on http://127.0.0.1:8200 ..."
  (
    cd "$FRONTEND_DIR"
    nohup npm run dev -- --hostname 127.0.0.1 --port 8200 >"$FRONTEND_LOG" 2>&1 &
    echo $! >"$FRONTEND_PID_FILE"
  )
  sleep 2

  local pid
  pid="$(read_pid "$FRONTEND_PID_FILE")"
  if [[ -n "$pid" ]] && is_running "$pid"; then
    echo "Frontend started (pid=$pid)"
    return 0
  fi

  echo "Frontend failed to start. Check log: $FRONTEND_LOG"
  return 1
}

stop_one() {
  local name="$1"
  local pid_file="$2"
  local pid
  pid="$(read_pid "$pid_file" || true)"

  if [[ -z "${pid:-}" ]]; then
    echo "$name not running (no pid file)"
    return 0
  fi

  if is_running "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    if is_running "$pid"; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    echo "$name stopped (pid=$pid)"
  else
    echo "$name not running (stale pid file: $pid)"
  fi

  rm -f "$pid_file"
}

status_one() {
  local name="$1"
  local pid_file="$2"
  local pid
  pid="$(read_pid "$pid_file" || true)"
  if [[ -n "${pid:-}" ]] && is_running "$pid"; then
    echo "$name: running (pid=$pid)"
  else
    echo "$name: stopped"
  fi
}

start_all() {
  start_backend
  start_frontend
  echo "Logs:"
  echo "  Backend:  $BACKEND_LOG"
  echo "  Frontend: $FRONTEND_LOG"
}

stop_all() {
  stop_one "Frontend" "$FRONTEND_PID_FILE"
  stop_one "Backend" "$BACKEND_PID_FILE"
}

status_all() {
  local backend_pid
  backend_pid="$(read_pid "$BACKEND_PID_FILE" || true)"
  if [[ -n "${backend_pid:-}" ]] && is_running "$backend_pid"; then
    echo "Backend: running (pid=$backend_pid)"
  elif backend_healthcheck; then
    echo "Backend: running (detected by health check, pid file stale/missing)"
  else
    echo "Backend: stopped"
  fi

  local frontend_pid
  frontend_pid="$(read_pid "$FRONTEND_PID_FILE" || true)"
  if [[ -n "${frontend_pid:-}" ]] && is_running "$frontend_pid"; then
    echo "Frontend: running (pid=$frontend_pid)"
  elif frontend_healthcheck; then
    echo "Frontend: running (detected by health check, pid file stale/missing)"
  else
    echo "Frontend: stopped"
  fi
}

cmd="${1:-start}"
case "$cmd" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  status)
    status_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
