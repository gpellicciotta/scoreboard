const MIN_PLAYER_COUNT = 2;
const MAX_PLAYER_COUNT = 7;

const playersPlus1Button = document.getElementById('players-plus-1-button');
const playersMinus1Button = document.getElementById('players-minus-1-button');
const addPlayerButton = document.getElementById('add-player-button');
const resetButton = document.getElementById("reset-button");

if (!customElements.get("counter-input")) {
  class CounterInput extends HTMLElement {
    constructor() {
      super();
      this.value = 0;
      this.minValue = 0;
      this.maxValue = 10;
    }

    connectedCallback() {
      const shadowRoot = this.attachShadow({mode: "open"});
      
      this.minusButton = document.createElement("button");
      this.minusButton.classList.add("minus");
      this.minusButton.disabled = true;
      this.minusButton.innerText = "-";
      shadowRoot.appendChild(this.minusButton);
     
      this.valueEl = document.createElement("span");
      this.valueEl.innerText = "0";
      shadowRoot.appendChild(this.valueEl);

      this.plusButton = document.createElement("button");
      this.plusButton.classList.add("plus");
      this.plusButton.innerText = "+";
      shadowRoot.appendChild(this.plusButton);
      
      this.plusButton.addEventListener("click", (e) => {
        this.value = Math.min(Math.max(this.minValue, this.value + 1), this.maxValue);
        this.#checkValue();       
      });
      this.minusButton.addEventListener("click", (e) => {
        this.value = Math.min(Math.max(this.minValue, this.value - 1), this.maxValue);
        this.#checkValue();  
      });
    
      // Create some CSS to apply to the shadow dom
      const style = document.createElement("style");
      style.textContent = `
        :host {
          display: grid;
          grid-template-columns: 1em 1fr 1em;
          justify-content: center;
          align-items: stretch;
          gap: 0.5em;
          background-color: purple;
        }

        :host > * {
          padding: 0.25rem;
          border: none;
          outline: none;
          font-size: 100%;
        }

        .plus:not(:disabled):active,
        .minus:not(:disabled):active {
          font-weight: bolder;
          opacity: 50%;
        }

        .plus:disabled,
        .minus:disabled {
          color: #d1d1d1;
          background-color: #dedede;
          cursor: not-allowed;
        }

      `;
      shadowRoot.appendChild(style);    
    }

    #checkValue() {
      this.value = Math.min(Math.max(this.minValue, this.value), this.maxValue);
      this.valueEl.innerText = this.value;
      if (this.value === this.minValue) {
        this.minusButton.disabled = true;
        this.minusButton.setAttribute("title", "Minimum value reached");
      }
      else {
        this.minusButton.disabled = false;
        this.minusButton.setAttribute("title", "Decrement value");
      }
      if (this.value === this.maxValue) {
        this.plusButton.disabled = true;
        this.plusButton.setAttribute("title", "Maximum value reached");
      }
      else {
        this.plusButton.disabled = false;
        this.plusButton.setAttribute("title", "Increment value");
      } 
    }
  };

  customElements.define("counter-input", CounterInput);
}


function recalculate() {
  let players = +(document.body.dataset.playerCount || 0);

  let maxPoints = 0;
  for (let i = 1; i <= players; i++) {
    let blueCardsInput = document.body.querySelector('.card > .row.blue-cards > input.player-' + i);
    let greenCardsInput = document.body.querySelector('.card > .row.green-cards > input.player-' + i);
    let yellowCardsInput = document.body.querySelector('.card > .row.yellow-cards > input.player-' + i);
    let purpleCardsInput = document.body.querySelector('.card > .row.purple-cards > input.player-' + i);
    let wondersInput = document.body.querySelector('.card > .row.wonders > input.player-' + i);
    let greenCoinsInput = document.body.querySelector('.card > .row.green-coins > input.player-' + i);
    let moneyCoinsInput = document.body.querySelector('.card > .row.money-coins > input.player-' + i);
    let militaryInput = document.body.querySelector('.card > .row.military > input.player-' + i);
    let sumInput = document.body.querySelector('.card > .row.sum > input.player-' + i);
    // Calculate:
    let totalPoints =  (+blueCardsInput.value) + 
                       (+greenCardsInput.value) +
                       (+yellowCardsInput.value) +
                       (+purpleCardsInput.value) +
                       (+wondersInput.value) +
                       (greenCoinsInput ? +greenCoinsInput.value : 0) + // Not used in full game
                       (+moneyCoinsInput.value) +
                       (+militaryInput.value);
    // Assign:
    sumInput.value = totalPoints;     
    
    // Reset winner status:
    sumInput.classList.remove('winner');
    let nameInput = document.body.querySelector('.card > .row.players > input.player-' + i);  
    nameInput.classList.remove('winner');

    // Check max points:
    if (totalPoints > maxPoints) {
      maxPoints = totalPoints;
    }
  }
  // Now check/mark the winner(s):
  if (maxPoints > 0) {
    for (let i = 1; i <= players; i++) {
      let sumInput = document.body.querySelector('.card > .row.sum > input.player-' + i);
      let nameInput = document.body.querySelector('.card > .row.players > input.player-' + i);    
      if (+sumInput.value === maxPoints) {
        sumInput.classList.add('winner');
        nameInput.classList.add('winner');
      }
    }                 
  }
}

function resetScores() {
  for (let i = 1; i <= MAX_PLAYER_COUNT; i++) {
    let nameInput = document.body.querySelector('.card > .row.players > input.player-' + i);  
    nameInput.classList.remove('winner');

    let blueCardsInput = document.body.querySelector('.card > .row.blue-cards > input.player-' + i);
    blueCardsInput.value = 0;

    let greenCardsInput = document.body.querySelector('.card > .row.green-cards > input.player-' + i);
    greenCardsInput.value = 0;

    let yellowCardsInput = document.body.querySelector('.card > .row.yellow-cards > input.player-' + i);
    yellowCardsInput.value = 0;

    let purpleCardsInput = document.body.querySelector('.card > .row.purple-cards > input.player-' + i);
    purpleCardsInput.value = 0;

    let wondersInput = document.body.querySelector('.card > .row.wonders > input.player-' + i);
    wondersInput.value = 0;

    let greenCoinsInput = document.body.querySelector('.card > .row.green-coins > input.player-' + i);
    if (greenCoinsInput) { // Not used in full game
      greenCoinsInput.value = 0;
    }

    let moneyCoinsInput = document.body.querySelector('.card > .row.money-coins > input.player-' + i);
    moneyCoinsInput.value = 0;

    let militaryInput = document.body.querySelector('.card > .row.military > input.player-' + i);
    militaryInput.value = 0;

    let sumInput = document.body.querySelector('.card > .row.sum > input.player-' + i);
    sumInput.classList.remove('winner');
    sumInput.value = 0;
  }

  document.body.querySelector('.card > .row.players > .player-1').focus();
}

document.querySelectorAll("input[type=number]").forEach((el) => {
  if (el.readOnly) {
    return ;
  }
  el.addEventListener("focus", (e) => {
    el.select();
  });
  el.addEventListener("keydown", (e) => {
    if (e.keyCode === 107) { // Plus key
      el.value = +el.value + 1;
      e.preventDefault();
    }
    else if (e.keyCode === 109) { // Minus key
      el.value = Math.max(0, +el.value - 1);
      e.preventDefault();
    }
    recalculate();
  });
  el.addEventListener("change", (e) => {
    if (+el.value < 0) {
      el.value = 0;
    }
    recalculate();
  });  
});

if (resetButton) {
  resetButton.addEventListener("click", (e) => {
    resetScores();
  });
}

if (addPlayerButton) {
  addPlayerButton.addEventListener("click", (e) => {
    e.preventDefault();

    let cnt = +(document.body.dataset.playerCount || 0);
    cnt += 1;

    updatePlayerCount(cnt);
  });
}

if (playersPlus1Button) {
  playersPlus1Button.addEventListener("click", (e) => {
    e.preventDefault();

    let cnt = +(document.body.dataset.playerCount || 0);
    cnt = Math.min(MAX_PLAYER_COUNT, cnt + 1);

    updatePlayerCount(cnt);
  });
}

if (playersMinus1Button) {
  playersMinus1Button.addEventListener("click", (e) => {
    e.preventDefault();

    let cnt = +(document.body.dataset.playerCount || 0);
    cnt = Math.max(MIN_PLAYER_COUNT, cnt - 1);

    updatePlayerCount(cnt);
  });
}

/* Start with minimum number of players */
updatePlayerCount(MIN_PLAYER_COUNT);

function updatePlayerCount(playerCount) {
  // Store for easy retrieval later
  let oldPlayerCount = +(document.body.dataset.playerCount || 0);
  document.body.dataset.playerCount = playerCount;

  // Update styles
  document.body.style.setProperty('--player-count', playerCount);
  for (let i = 1; i <= MAX_PLAYER_COUNT; i++) {
    if (i <= playerCount) {
      document.body.classList.add("player-" + i);
    }
    else {
      document.body.classList.remove("player-" + i);
    }
  }
  if (oldPlayerCount != playerCount) {
    resetScores();
  }
}