# 14–0: IPL Draft Challenge

**[Play the game here](https://classy-klepon-5de775.netlify.app/)**

**Draft six IPL cricketers. Build an XI. Try to win all 14 matches.**

14–0 is a browser game where every pick starts with a spin. The reels draw an IPL franchise and an auction cycle, and you pick from the players who represented that franchise during that window. A player’s stats and ratings come from the window you drafted them in, so the same player can be a very different pick in another era.

## How to play

1. **Spin the reels.** Each of the six rounds gives you a franchise and an auction cycle. You can respin the franchise once and the cycle once per draft.
2. **Fill your lineup.** Draft two batters, a wicketkeeper, an all-rounder, a spinner, and a pacer. You can draft each player only once and take at most two overseas players. Pick a role on a player’s card or drag them into an eligible slot.
3. **Simulate the season.** The game sets your batting order and fills out the XI with five domestic support players. Your team plays 14 simulated matches against different opponents and at different venues.
4. **Chase 14–0.** See your final record, share your team, or try a fresh draft.

**Standard mode** shows historical stats and role ratings. **Hard mode** hides those numbers and leaves you with player names and eligible roles.


## What powers the game

The draft pool covers **809 players and 15 franchises across the 2008–2026 IPL seasons**. Ratings compare players with their peers from the same seasons and account for role and phase of play. For example, a spinner’s middle-overs performance and a pacer’s death-overs performance can matter more on different surfaces.

Historical match data and player identities come from Cricsheet. See [data and simulation notes](MODEL.md) for source credits, coverage gaps, rating formulas, and instructions for rebuilding the player pool.

Run the draft and simulation tests with `npm test`.
