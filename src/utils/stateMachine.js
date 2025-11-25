// src/utils/stateMachine.js

/**
 * Generic StateMachine for managing behavior and animation states.
 *
 * Each state is an object with optional methods:
 *   - enter(previousState)
 *   - exit(nextState)
 *   - update(dt, stateTime)
 *   - onEvent(eventName, ...args)
 *
 * Usage:
 *   const sm = new StateMachine({
 *     idle:    { enter() {}, update(dt) {}, exit() {} },
 *     walking: { enter() {}, update(dt) {}, exit() {} },
 *   }, 'idle');
 *
 *   sm.setState('walking');
 *   sm.update(dt);
 *   sm.dispatch('roar');
 */
export class StateMachine {
  /**
   * @param {Object<string, Object>} states - State definitions
   * @param {string} initial               - Initial state name
   * @param {function=} onChange           - Optional: (prev, next) => void
   */
  constructor(states, initial, onChange = null) {
    this.states = states;
    this.current = initial;
    this.previous = null;
    this.stateTime = 0;
    this._onChange = onChange;

    // Call enter for initial state
    if (this.states[initial]?.enter) {
      this.states[initial].enter(null);
    }
  }

  /**
   * Transition to a new state.
   * @param {string} next - Next state name
   */
  setState(next) {
    if (!this.states[next]) {
      console.error(`[StateMachine] Tried to set invalid state: ${next}`);
      return;
    }
    if (this.current === next) {
      // Already in this state; no transition.
      return;
    }

    // Call exit on current state
    if (this.states[this.current]?.exit) {
      this.states[this.current].exit(next);
    }

    const prev = this.current;
    this.previous = this.current;
    this.current = next;
    this.stateTime = 0;

    // Call enter on next state
    if (this.states[next]?.enter) {
      this.states[next].enter(prev);
    }

    // Optional onChange hook
    if (typeof this._onChange === 'function') {
      this._onChange(prev, next);
    }
  }

  /**
   * Update the current state.
   * @param {number} dt - Delta time (seconds)
   */
  update(dt) {
    this.stateTime += dt;
    if (this.states[this.current]?.update) {
      this.states[this.current].update(dt, this.stateTime);
    }
  }

  /**
   * Dispatch an event to the current state.
   * If the state has an onEvent method, it will be called.
   * @param {string} eventName
   * @param  {...any} args
   */
  dispatch(eventName, ...args) {
    if (this.states[this.current]?.onEvent) {
      this.states[this.current].onEvent(eventName, ...args);
    } else {
      console.warn(`[StateMachine] No event handler for event '${eventName}' in state '${this.current}'`);
    }
  }

  /**
   * Returns the name of the current state.
   * @returns {string}
   */
  getState() {
    return this.current;
  }

  /**
   * Returns time (seconds) spent in the current state.
   * @returns {number}
   */
  getStateTime() {
    return this.stateTime;
  }
}
