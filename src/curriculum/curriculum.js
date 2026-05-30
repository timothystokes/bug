'use strict';

const { RNG } = require('../util/rng');

// Automation harness (README "Automating interactions for faster-than-real-time
// learning"). A synthetic teacher streams canned input into the stdin/text
// channel instead of waiting for a human, so the brain can run far faster than
// wall-clock. Each curriculum item carries an extrinsic-reward tag for RPE
// plasticity (Principle 5). Reward is mostly intrinsic (prediction-error
// reduction), but structured lessons provide extrinsic shaping.
//
// Zero external datasets (zero runtime deps): lessons are procedurally generated
// but *structured* (repeated patterns, simple grammar, counting) so that
// predictive-coding error is expected to fall as the pattern is learned.
//
// Lessons are ordered roughly from most predictable to most complex, so a
// learner advancing through them goes through a developmental curriculum.
const LESSONS = {
  // ---- Phase 1: rhythm & primitives (very high predictability) ----
  rhythm: () => 'ab ab ab ab ',
  alphabet: () => 'abcdefghijklmnopqrstuvwxyz ',
  counting: () => '1 2 3 4 5 6 7 8 9 0 ',

  // Doubled letters / common English bigrams: builds short-range predictors.
  bigrams: () => {
    const pairs = ['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd',
                   'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
                   'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le'];
    let s = '';
    for (let i = 0; i < 8; i++) s += pick(pairs) + ' ';
    return s;
  },

  // ---- Phase 2: temporal sequences (medium predictability) ----
  weekdays: () => 'monday tuesday wednesday thursday friday saturday sunday ',
  months:   () => 'january february march april may june july august september october november december ',
  arithmetic: () => {
    let s = '';
    for (let i = 0; i < 5; i++) {
      const a = 1 + Math.floor(Math.random() * 9);
      const b = 1 + Math.floor(Math.random() * 9);
      s += `${a} plus ${b} is ${a + b}. `;
    }
    return s;
  },

  // ---- Phase 3: tiny grammar (compositional structure) ----
  grammar: () => {
    const subj = ['cat', 'dog', 'bee', 'fox', 'bird', 'fish'];
    const verb = ['sees', 'eats', 'likes', 'finds', 'wants'];
    const obj  = ['food', 'sun', 'tree', 'home', 'water', 'sky'];
    return `the ${pick(subj)} ${pick(verb)} the ${pick(obj)}. `;
  },

  // Colour + object: associates an attribute with a noun consistently.
  colours: () => {
    const col = ['red', 'blue', 'green', 'yellow', 'black', 'white'];
    const obj = ['apple', 'sky', 'leaf', 'sun', 'cat', 'cloud'];
    return `the ${pick(col)} ${pick(obj)}. `;
  },

  // ---- Phase 4: dialog turns (closed-loop conversational structure) ----
  greetings: () => {
    const turns = [
      'hello. hi. how are you. i am well. ',
      'good morning. good morning. how are you. fine thanks. ',
      'hi there. hello. what is your name. i am bug. ',
    ];
    return pick(turns);
  },

  qa: () => {
    const qas = [
      'what is the sky. the sky is blue. ',
      'what eats food. the cat eats food. ',
      'where is the sun. the sun is in the sky. ',
      'what is two plus two. two plus two is four. ',
      'who likes the tree. the bird likes the tree. ',
    ];
    return pick(qas);
  },

  // ---- Phase 5: nested / hierarchical structure (highest difficulty) ----
  // Balanced brackets: a brain that learns this has captured recursion depth.
  nested: () => {
    const depth = 1 + Math.floor(Math.random() * 3);
    let s = '';
    for (let d = 0; d < depth; d++) s += '( ';
    s += 'core ';
    for (let d = 0; d < depth; d++) s += ') ';
    return s;
  },

  // Markov-ish English: sample bigram transitions over a small vocabulary.
  // Locally plausible, globally drifting — a harder prediction target.
  english: () => {
    const next = {
      the: ['cat', 'dog', 'sun', 'bird', 'tree', 'sky', 'old', 'small'],
      cat: ['eats', 'sees', 'sleeps', 'and'],
      dog: ['runs', 'eats', 'and', 'sees'],
      sun: ['rises', 'sets', 'is', 'shines'],
      bird: ['flies', 'sings', 'sees', 'lands'],
      tree: ['grows', 'falls', 'is', 'shades'],
      sky: ['is', 'turns', 'glows'],
      eats: ['food', 'fish', 'fruit'],
      sees: ['the', 'a'],
      runs: ['fast', 'home', 'and', 'free'],
      old: ['cat', 'dog', 'tree', 'bird'],
      small: ['cat', 'dog', 'bird'],
      and: ['the', 'a'],
      a: ['cat', 'dog', 'bird', 'tree'],
      is: ['warm', 'cold', 'blue', 'green', 'here'],
    };
    let word = 'the';
    let out = word;
    for (let i = 0; i < 12; i++) {
      const opts = next[word] || ['the'];
      word = opts[Math.floor(Math.random() * opts.length)];
      out += ' ' + word;
    }
    return out + '. ';
  },
};

// Higher reward for early/predictable lessons (clear signal for the learner),
// lower reward for compositional ones (the brain should be carried more by its
// own intrinsic prediction-error reward there).
const REWARDS = {
  rhythm: 0.6, alphabet: 0.5, counting: 0.5, bigrams: 0.45,
  weekdays: 0.45, months: 0.45, arithmetic: 0.4,
  grammar: 0.3, colours: 0.3,
  greetings: 0.35, qa: 0.35,
  nested: 0.2, english: 0.2,
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const DEFAULT_ORDER = [
  'rhythm', 'alphabet', 'counting', 'bigrams',
  'weekdays', 'months', 'arithmetic',
  'grammar', 'colours',
  'greetings', 'qa',
  'nested', 'english',
];

class Curriculum {
  constructor(opts = {}) {
    this.rng = new RNG(opts.seed || 12345);
    this.lessonOrder = opts.lessons || DEFAULT_ORDER;
    this.lessonIdx = 0;
    this.buffer = '';
    this.charsServed = 0;
    this.reward = 0;
  }

  // Refill the buffer from the current lesson; rotate lessons over time so the
  // brain experiences a structured developmental curriculum.
  refill() {
    const name = this.lessonOrder[this.lessonIdx % this.lessonOrder.length];
    const lesson = LESSONS[name];
    if (!lesson) { this.lessonIdx++; return this.refill(); }
    this.buffer += lesson();
    this.reward = REWARDS[name] != null ? REWARDS[name] : 0.4;
    // Advance lesson occasionally so the brain sees the whole curriculum.
    if (this.rng.random() < 0.1) this.lessonIdx++;
  }

  next() {
    if (this.buffer.length === 0) this.refill();
    const ch = this.buffer[0];
    this.buffer = this.buffer.slice(1);
    this.charsServed++;
    return { token: ch, reward: this.reward };
  }

  currentLesson() {
    return this.lessonOrder[this.lessonIdx % this.lessonOrder.length];
  }
}

module.exports = { Curriculum, LESSONS, REWARDS, DEFAULT_ORDER };
