# Changelog and Plans

## Todo's 
- [ ] Re-use more code from hinolugi-utils.js
- [ ] Re-structure as the counters app is structured

## Releases

### v2.1.0 - 2026-01-24
- Bug fixes:
  - Make sure to count "points" for money coins, instead of the count of counts (and automatically dividing by 3)
- Improved rendering logic to be more incremental, hence improving specifically the mobile UX (less flicker and loss of scroll positions)

### v2.0.0 - 2026-01-15
- Bug fixes:
  - Cloud file naming for finished games is handled correctly now  
- UI improvements:  
  - Sidebar bottom action not being visible in mobile mode
  - No longer shift scoreboard when expanding sidebar
  - Added theme switch action for dark/light mode; use system-theme by default
  - Improved sidebar layout and mobile behavior
  - Finished games UI: better date formatting + show ranks for top-3 players in expanded view
- Making sure ranks are stored when finishing a game
- Added welcome screen on first load
- Much improved UI for Seven Wonders games, now also allowing for Military and Scientific victories in the Duel edition
- Updated documentation
- Added notification area for long-running actions and also for showing errors/warnings

### v1.0.0 - Initial Release (2025-01-03)
- First version allowing to create scoreboards for simple games with multiple players.
- Features:
  - Add/remove players
  - Update player scores
  - Save/load scoreboard state to/from Google Drive
  - Auto-sort players by score
  - Celebration link usage after finishing the game
  - Dedicated UI for Seven Wonders scoreboards