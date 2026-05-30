'use strict';

// Tiny structured logger. Keeps console output readable and timestamped.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
let currentLevel = LEVELS.info;

function setLevel(name) {
  if (LEVELS[name] != null) currentLevel = LEVELS[name];
}

function fmt(level, tag, msg) {
  const t = new Date().toISOString().split('T')[1].replace('Z', '');
  return `[${t}] ${level.toUpperCase().padEnd(5)} ${tag ? `(${tag}) ` : ''}${msg}`;
}

function make(tag) {
  return {
    debug: (m) => { if (currentLevel <= LEVELS.debug) console.error(fmt('debug', tag, m)); },
    info: (m) => { if (currentLevel <= LEVELS.info) console.log(fmt('info', tag, m)); },
    warn: (m) => { if (currentLevel <= LEVELS.warn) console.error(fmt('warn', tag, m)); },
    error: (m) => { if (currentLevel <= LEVELS.error) console.error(fmt('error', tag, m)); },
  };
}

module.exports = { make, setLevel, LEVELS };
