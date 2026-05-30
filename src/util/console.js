'use strict';

// Styled console output so brain vocalisations and user input are visually
// distinct in interactive sessions. Brain output is buffered so we emit a
// coherent utterance rather than one character at a time, and is written
// *above* the readline prompt so it never clobbers in-progress typing.

const isTTY = !!process.stdout.isTTY;
const STYLE = isTTY ? {
  brain: '\x1b[36m',  // cyan
  user:  '\x1b[33m',  // yellow
  sys:   '\x1b[90m',  // dim grey
  reset: '\x1b[0m',
} : { brain: '', user: '', sys: '', reset: '' };

let buffer = '';
let flushTimer = null;
const QUIET_MS = 800;
const MAX_LEN = 80;

// CLI registers a function that (a) clears the current prompt line, (b) we
// write our output, (c) redraws the prompt with the user's in-progress input.
let writeAbovePrompt = (text) => process.stdout.write(text);
function setWriter(fn) { if (fn) writeAbovePrompt = fn; }

function flushBrain() {
  if (!buffer.length) return;
  const text = buffer.replace(/\s+/g, ' ').trim();
  buffer = '';
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!text) return;
  writeAbovePrompt(`${STYLE.brain}🧠 ${text}${STYLE.reset}\n`);
}

function brainChar(ch) {
  if (ch == null || ch === '') return;
  buffer += ch;
  if (/[.!?\n]/.test(ch) || buffer.length >= MAX_LEN) {
    flushBrain();
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushBrain, QUIET_MS);
}

function userLine(text) {
  if (!text) return;
  writeAbovePrompt(`${STYLE.user}👤 ${text}${STYLE.reset}\n`);
}

function sys(text) {
  writeAbovePrompt(`${STYLE.sys}${text}${STYLE.reset}\n`);
}

// Generic: write any multi-line block above the prompt (used by stats output
// and other long messages so they don't fight with the prompt line).
function block(text) {
  if (text == null) return;
  const t = String(text);
  writeAbovePrompt(t.endsWith('\n') ? t : t + '\n');
}

module.exports = { brainChar, userLine, sys, block, flushBrain, setWriter, STYLE };

