/*
 * # CounterInput - Overview, usage and CSS customization
 * 
 * ## What it is
 * `CounterInput` is a small reusable Web Component that provides a compact numeric stepper with `+` and `-` buttons. It's registered as the
 * custom element `counter-input` and can be used anywhere in the app as an HTML element.
 * 
 * ## Key behaviors / API
 * - Attributes supported: `min`, `max`, `value` (all numeric). 
 *   These are reflected to properties and observed for changes.
 * - Public property: `.value` — get or set the current numeric value.
 * - Events: dispatches a standard `change` event (bubbles) whenever the
 *   value is adjusted via the UI.  
 *   Example: `el.addEventListener('change', e => ...)`.
 * 
 * ## Example markup
 * ```
 *   <counter-input min="0" max="99" value="3"></counter-input>
 * ```
 * 
 * ## How to use from JS
 * ```
 *   const el = document.querySelector('counter-input');
 *   el.value = 5; // Programmatic update
 *   el.addEventListener('change', () => console.log('value changed to', el.value));
 * ```
 * 
 * ## Styling / customization
 * This component exposes a set of CSS custom properties that are consumed
 * inside its shadow DOM. Each variable has a sensible fallback so the
 * component renders nicely without overrides.
 * 
 * Available CSS variables and defaults:
 * 
 * - --counter-border-color: var(--muted-border)
 * - --counter-border-radius: 0.375rem
 * - --counter-bg: var(--config-editor-bg)
 * - --counter-padding: 0.25rem
 * - --counter-width: fit-content
 * - --counter-font-family: var(--monospace-font)
 * 
 * - --counter-btn-font-size: 1rem
 * - --counter-btn-bg: var(--blue)
 * - --counter-btn-color: var(--btn-contrast)
 * - --counter-btn-radius: 0.25rem
 * - --counter-btn-size: 2em
 * - --counter-btn-disabled-opacity: 0.5
 * 
 * - --counter-value-font-family: var(--monospace-font)
 * - --counter-value-width: 3em
 * - --counter-value-color: inherit
 * - --counter-value-weight: 700
 * 
 * Example CSS overrides (put in your app stylesheet):
 * ```
 * counter-input {
 *     --counter-btn-bg: #0ea5a4;
 *     --counter-btn-color: #fff;
 *     --counter-bg: rgba(255,255,255,0.02);
 *     --counter-btn-size: 2.25em;
 *     --counter-value-width: 4ch;
 *     --counter-border-color: rgba(255,255,255,0.06);
 * }
 * ```    
 * 
 * ## Notes
 * - The variables cascade into the shadow DOM, so setting them on the
 *   `counter-input` element (or on `:root`) will affect appearance.
 * - If we later need finer control over internal elements (e.g., different
 *   styles for plus and minus buttons), we can add `part` attributes and
 *   document `::part()` selectors for external styling.
 */
class CounterInput extends HTMLElement {
  constructor() {
    super();
    this._value = 0;
    this.minValue = 0;
    this.maxValue = 99;
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = val;
    this.setAttribute('value', val);
    this.checkValue();
  }

  static get observedAttributes() {
    return ['value', 'min', 'max'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    const value = parseInt(newValue, 10);
    if (name === 'value') {
      this._value = value;
    } else if (name === 'min') {
      this.minValue = value;
    } else if (name === 'max') {
      this.maxValue = value;
    }
    this.checkValue();
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
            <style>
                /* Expose appearance via CSS custom properties with sensible fallbacks */
                :host { 
                  display: inline-grid; 
                  grid-template-columns: auto auto auto; 
                  align-items: center; 
                  gap: 0.25rem;
                  border: 1px solid var(--counter-border-color, rgba(0,0,0,0.08));
                  border-radius: var(--counter-border-radius, 0.375rem);
                  background: var(--counter-bg, #ffffff);
                  padding: var(--counter-padding, 0.25rem);
                  width: var(--counter-width, fit-content);
                  font-family: var(--counter-font-family, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
                }
                button { 
                  font-size: var(--counter-btn-font-size, 1rem); 
                  cursor: pointer; 
                  background: var(--counter-btn-bg, #2563eb);
                  color: var(--counter-btn-color, #ffffff);
                  border: none;
                  border-radius: var(--counter-btn-radius, 0.25rem);
                  width: var(--counter-btn-size, 2em);
                  height: var(--counter-btn-size, 2em);
                }
                button:disabled {
                  opacity: var(--counter-btn-disabled-opacity, 0.5);
                  cursor: not-allowed;
                }
                span.value { 
                  text-align: center; 
                  font-family: var(--counter-value-font-family, monospace);
                  width: var(--counter-value-width, 3em);
                  overflow: hidden;
                  text-overflow: ellipsis;
                  color: var(--counter-value-color, #111111);
                  font-weight: var(--counter-value-weight, 700);
                }
            </style>
            <button class="minus">-</button>
            <span class="value">0</span>
            <button class="plus">+</button>
        `;

    this.minusButton = this.shadowRoot.querySelector('.minus');
    this.plusButton = this.shadowRoot.querySelector('.plus');
    this.valueEl = this.shadowRoot.querySelector('.value');

    if (this.hasAttribute('min')) {
      this.minValue = parseInt(this.getAttribute('min'), 10);
    }
    if (this.hasAttribute('max')) {
      this.maxValue = parseInt(this.getAttribute('max'), 10);
    }
    if (this.hasAttribute('value')) {
      this._value = parseInt(this.getAttribute('value'), 10);
    } 
    else {
      this.setAttribute('value', this._value);
    }

    this.plusButton.addEventListener("click", () => {
      this.value = Math.min(this.maxValue, this.value + 1);
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    this.minusButton.addEventListener("click", () => {
      this.value = Math.max(this.minValue, this.value - 1);
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });

    this.checkValue();
  }

  checkValue() {
    if (this.valueEl) {
      this.valueEl.innerText = this.value;
    }
    if (this.minusButton) { 
      this.minusButton.disabled = this.value <= this.minValue; 
    }
    if (this.plusButton) { 
      this.plusButton.disabled = this.value >= this.maxValue; 
    }
  }
}

customElements.define("counter-input", CounterInput);
