'use strict';

const readline = require('readline');
const snapshot = require('../persist/snapshot');

// CLI command loop (README "Introspect"): stats / examine / save / sleep / exit.
// Free text typed at the prompt is fed into the somatic/keyboard channel.
function startCLI(brain, runner) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  printHelp();
  process.stdout.write('\nbrain> ');

  rl.on('line', (line) => {
    const text = line.trim();
    const [cmd, ...rest] = text.split(/\s+/);
    switch (cmd) {
      case 'stats':
        console.log(JSON.stringify(brain.stats(), null, 2));
        break;
      case 'examine': {
        let idx;
        const tok = rest[0];
        if (tok == null) {
          idx = Math.floor(Math.random() * brain.populations.n);
        } else if (/^\d+$/.test(tok)) {
          idx = parseInt(tok, 10);
        } else {
          // Region name: pick a random neuron within that region.
          const region = brain.config.regions.find(
            (r) => r.name.toLowerCase() === tok.toLowerCase()
          );
          if (!region) {
            console.log(
              `unknown region "${tok}". Regions: ${brain.config.regions.map((r) => r.name).join(', ')}`
            );
            break;
          }
          idx = region.start + Math.floor(Math.random() * region.count);
        }
        console.log(JSON.stringify(brain.examine(idx), null, 2));
        break;
      }
      case 'save':
        runner.save();
        console.log(`saved (checksum ${brain.checksum()})`);
        break;
      case 'sleep': {
        const cycles = rest[0] ? parseInt(rest[0], 10) : 200;
        const r = brain.sleep(cycles);
        console.log(`slept: ${JSON.stringify(r)}`);
        break;
      }
      case 'feed':
        brain.feedText(rest.join(' ') + ' ');
        console.log('fed to somatic channel');
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
        // Any other text is sensory input (the keyboard/proprio channel).
        brain.feedText(text + ' ');
        break;
    }
    process.stdout.write('brain> ');
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
