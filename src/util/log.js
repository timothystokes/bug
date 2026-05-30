'use strict';

// Tiny structured logger. Keeps console output readable and timestamped.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
let currentLevel = LEVELS.info;
let writer = null;

function setLevel(name) {
  if (LEVELS[name] != null) currentLevel = LEVELS[name];
}

// Allow the CLI to route log lines through its "log above prompt" helper so
// they don't clobber the readline prompt.
function setWriter(fn) { writer = fn; }

function fmt(level, tag, msg) {
  const t = new Date().toISOString().split('T')[1].replace('Z', '');
  return `[${t}] ${level.toUpperCase().padEnd(5)} ${tag ? `(${tag}) ` : ''}${msg}`;
}

function emit(line, isErr) {
  if (writer) { writer(line + '\n'); return; }
  if (isErr) console.error(line); else console.log(line);
}

function make(tag) {
  return {
    debug: (m) => { if (currentLevel <= LEVELS.debug) emit(fmt('debug', tag, m), true); },
    info:  (m) => { if (currentLevel <= LEVELS.info)  emit(fmt('info',  tag, m), false); },
    warn:  (m) => { if (currentLevel <= LEVELS.warn)  emit(fmt('warn',  tag, m), true); },
    error: (m) => { if (currentLevel <= LEVELS.error) emit(fmt('error', tag, m), true); },
  };
}

module.exports = { make, setLevel, setWriter, LEVELS };
