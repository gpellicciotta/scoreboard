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
                :host { 
                    display: inline-grid; 
                    grid-template-columns: auto auto auto; 
                    align-items: center; 
                    gap: 0.25rem;
                    border: 1px solid var(--muted-border);
                    border-radius: 0.375rem;
                    background: var(--config-editor-bg);
                    padding: 0.25rem;
                    width: fit-content;
                }
                button { 
                    font-size: 1rem; 
                    cursor: pointer; 
                    background: var(--blue);
                    color: var(--btn-contrast);
                    border: none;
                    border-radius: 0.25rem;
                    width: 2em;
                    height: 2em;
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                span.value { 
                    text-align: center; 
                    font-family: var(--monospace-font);
                    width: 3em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            </style>
            <button class="minus">-</button>
            <span class="value">0</span>
            <button class="plus">+</button>
        `;

        this.minusButton = this.shadowRoot.querySelector('.minus');
        this.plusButton = this.shadowRoot.querySelector('.plus');
        this.valueEl = this.shadowRoot.querySelector('.value');

        if (this.hasAttribute('min')) this.minValue = parseInt(this.getAttribute('min'), 10);
        if (this.hasAttribute('max')) this.maxValue = parseInt(this.getAttribute('max'), 10);
        if (this.hasAttribute('value')) {
            this._value = parseInt(this.getAttribute('value'), 10);
        } else {
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
        if (this.valueEl) this.valueEl.innerText = this.value;
        if (this.minusButton) this.minusButton.disabled = this.value <= this.minValue;
        if (this.plusButton) this.plusButton.disabled = this.value >= this.maxValue;
    }
}

customElements.define("counter-input", CounterInput);
