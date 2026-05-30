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
const LESSONS = {
  // Highly predictable: a fixed repeating pattern. Error should fall fast.
  rhythm: () => 'ab ab ab ab ',
  // Counting structure.
  counting: () => '1 2 3 4 5 6 7 8 9 0 ',
  // Tiny grammar: subject verb object.
  grammar: () => {
    const subj = ['cat', 'dog', 'bee', 'fox'];
    const verb = ['sees', 'eats', 'likes'];
    const obj = ['food', 'sun', 'tree', 'home'];
    return `the ${pick(subj)} ${pick(verb)} the ${pick(obj)}. `;
  },
  // Alphabet drill.
  alphabet: () => 'abcdefghijklmnopqrstuvwxyz ',
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

class Curriculum {
  constructor(opts = {}) {
    this.rng = new RNG(opts.seed || 12345);
    this.lessonOrder = opts.lessons || ['rhythm', 'counting', 'grammar', 'alphabet'];
    this.lessonIdx = 0;
    this.buffer = '';
    this.charsServed = 0;
    this.reward = 0;
  }

  // Refill the buffer from the current lesson; rotate lessons over time so the
  // brain experiences a structured developmental curriculum.
  refill() {
    const name = this.lessonOrder[this.lessonIdx % this.lessonOrder.length];
    this.buffer += LESSONS[name]();
    // Extrinsic reward tag: predictable lessons carry a positive teaching reward.
    this.reward = name === 'grammar' ? 0.3 : 0.5;
    // Advance lesson occasionally.
    if (this.rng.random() < 0.1) this.lessonIdx++;
  }

  // Produce the next token (single character) with its reward tag.
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

module.exports = { Curriculum, LESSONS };
