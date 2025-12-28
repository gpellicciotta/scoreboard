# Nieuwjaarsquiz 2025 — Slides & Tools

This repository contains the quiz slides, scoreboard, and celebration pages used for the 2025 Nieuwjaarsquiz.

## Contents

- `quiz-*`: everything constituting the actual quiz:
  - `quiz-preparation.md`: notes about the quiz and how to set it up
  - `quiz-questions.md`: the full set of questions and answers
  - `quiz.html`: the full quiz slide deck, created via `generate-quiz-slides.js`

- `scoreboard-*`: a standalone scoreboard page to track points during the quiz

- `celebration-*`: a countdown + confetti page for the New Year celebration and/or quiz winner

## How to

### How to update/change the questions
Go to `quiz-questions.md` and edit the questions and answers as needed. Follow the existing format.
Then run the `generate-quiz-slides.js` script using Node.js to regenerate the `quiz-slides.md` and `quiz.html` files.

## How to keep track of points
Just open the `scoreboard.html` file in a web browser. 
You can click on the names to add points as participants answer questions correctly.
This can also be prepared by uploading a JSON file with participant names.
