'use strict';

const readline = require('readline');
const snapshot = require('../persist/snapshot');
const styled = require('../util/console');

// CLI command loop (README "Introspect"): stats / examine / save / sleep / exit.
// Free text typed at the prompt is fed into the somatic/keyboard channel.
function startCLI(brain, runner) {
  const isTTY = !!process.stdout.isTTY;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: isTTY,
    prompt: 'brain> ',
  });

  // Safe "log above prompt": erase current line, write the output, then
  // restore the prompt and whatever the user has typed so far. This is the
  // standard pattern for interleaving background log lines with an active
  // readline prompt.
  function writeAbovePrompt(text) {
    if (!isTTY) { process.stdout.write(text); return; }
    // Erase the current prompt line, write the message, then ask readline to
    // re-render the prompt + in-progress input + cursor in one shot. Using the
    // internal _refreshLine method is the standard pattern; it's been stable
    // across Node versions and avoids the double-echo we get if we both call
    // rl.prompt() and manually write rl.line.
    process.stdout.write('\r\x1b[2K');
    process.stdout.write(text);
    if (typeof rl._refreshLine === 'function') {
      rl._refreshLine();
    } else {
      rl.prompt(true);
    }
  }
  styled.setWriter(writeAbovePrompt);
  require('../util/log').setWriter(writeAbovePrompt);

  printHelp();
  process.stdout.write('\n');
  rl.prompt();

  rl.on('line', (line) => {
    styled.flushBrain();
    const text = line.trim();
    const [cmd, ...rest] = text.split(/\s+/);
    switch (cmd) {
      case 'stats':
        styled.block(JSON.stringify(brain.stats(), null, 2));
        break;
      case 'examine': {
        let idx;
        const tok = rest[0];
        if (tok == null) {
          idx = Math.floor(Math.random() * brain.populations.n);
        } else if (/^\d+$/.test(tok)) {
          idx = parseInt(tok, 10);
        } else {
          const region = brain.config.regions.find(
            (r) => r.name.toLowerCase() === tok.toLowerCase()
          );
          if (!region) {
            styled.sys(
              `unknown region "${tok}". Regions: ${brain.config.regions.map((r) => r.name).join(', ')}`
            );
            break;
          }
          idx = region.start + Math.floor(Math.random() * region.count);
        }
        styled.block(JSON.stringify(brain.examine(idx), null, 2));
        break;
      }
      case 'save':
        runner.save();
        styled.sys(`saved (checksum ${brain.checksum()})`);
        break;
      case 'sleep': {
        const cycles = rest[0] ? parseInt(rest[0], 10) : 200;
        const r = brain.sleep(cycles);
        styled.sys(`slept: ${JSON.stringify(r)}`);
        break;
      }
      case 'feed':
        styled.userLine(rest.join(' '));
        brain.feedText(rest.join(' ') + ' ');
        styled.sys('(fed to somatic channel)');
        break;
      case 'help':
      case '?':
        printHelp();
        break;
      case 'exit':
      case 'quit':
        shutdown(brain, runner, rl);
        return;
      case '':
        break;
      default:
        styled.userLine(text);
        brain.feedText(text + ' ');
        break;
    }
    rl.prompt();
  });

  rl.on('close', () => shutdown(brain, runner, rl));

  // Graceful shutdown on Ctrl-C / SIGTERM.
  const sig = () => shutdown(brain, runner, rl);
  process.on('SIGINT', sig);
  process.on('SIGTERM', sig);
}

let shuttingDown = false;
function shutdown(brain, runner, rl) {
  if (shuttingDown) return;
  shuttingDown = true;
  runner.stop();
  console.log('\n[shutdown] saving state...');
  try {
    snapshot.save(brain, runner.stateDir);
    console.log(`[shutdown] checksum ${brain.checksum()} — goodbye.`);
  } catch (e) {
    console.error(`[shutdown] save failed: ${e.message}`);
  }
  if (rl) rl.close();
  process.exit(0);
}

function printHelp() {
  console.log([
    'Commands:',
    '  stats          network statistics, E/I ratio, age, complexity',
    '  examine [i|region]  inspect neuron i, or a random neuron in a region',
    '  save           flush persistent state',
    '  sleep [n]      offline replay / consolidation (n cycles, default 200)',
    '  feed <text>    feed text into the somatic/keyboard channel',
    '  exit           graceful shutdown (state saved)',
    '  <any text>     also fed into the somatic channel',
  ].join('\n'));
}

module.exports = { startCLI };
