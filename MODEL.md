# Data and simulation notes

## Rebuild the data

```sh
node scripts/import.mjs
node --test
node scripts/balance.mjs
```

The import caches the public IPL JSON ZIP, Cricsheet People Register, and cricketdata player metadata in `.cache`. Set `IPL_CACHE` to use a different input directory. Pass `--refresh` to fetch current upstream files. The importer records SHA-256 hashes for the three downloaded inputs and the three checked-in supplements. Reusing the same input bytes produces the same `dist/pool.json` and `dist/coverage.json`.

The checked-in `data/scorecards.json` is a compact extraction of match roster positions, keeper dismissals, and player-role fields. To retry missing scorecards, run `node scripts/scorecards.mjs` after importing, then re-run the import. The scorecard updater uses batches of ten and preserves successful records between runs. `IPL_SCORECARD_LIMIT` caps the number attempted. `--refresh` retries existing records as well.

- Match data and player identities are from Cricsheet and are transformed into franchise and auction-window totals. The JSON and Register data use the Open Data Commons Attribution License. [IPL downloads](https://cricsheet.org/downloads/), [Register](https://cricsheet.org/register/), [license](https://cricsheet.org/licensing/)
- Official IPL reports verify the 2026 final and the available historical washout records. The fixture audit records the evidence for each missing archive entry. [Official results](https://www.iplt20.com/matches?status=results), [2026 final](https://www.iplt20.com/news/article/tata-ipl-2026-final-rcb-v-gt-match-report)
- Player roles and country information come from cricketdata, ESPNcricinfo scorecards joined through the Register, and source-linked overrides. Official IPL auction lists and retention records fill recent domestic classifications where available. [cricketdata](https://robjhyndman.r-universe.dev/cricketdata), [example scorecard feed](https://site.api.espn.com/apis/site/v2/sports/cricket/8048/summary?event=1535465), [IPL retention list](https://www.iplt20.com/news/article/tata-ipl-2026-player-retentions-announced), [IPL auction list](https://www.iplt20.com/news/article/tata-ipl-2026-player-auction-list-announced)

## Coverage

The shipped pool contains **1,958 franchise-cycle player records**, **809 players**, **57 franchise-cycle pairs**, and all five defunct franchises. The archive contains **1,243 matches across all 19 seasons**, including all 74 fixtures from 2026 and the May 31 final. The **11** scheduled fixtures absent from the archive were abandoned before a ball was bowled. The 2025 PBKS–DC match voided and replayed after the May 8 interruption has no delivery data in this snapshot.

Every imported player has an identity and country classification. Three bowlers with meaningful workloads have mixed spin and pace metadata, so the game withholds both specialist bowling slots for those records. The full audit lists them and the missing scorecard IDs. ESPN returned **745 of 1,243** scorecards. Stumpings verify additional keeping appearances. Windows with neither a verified scorecard designation nor a stumping stay ineligible for the keeper slot. Individual missed chances are unavailable. See [the coverage audit](dist/coverage.json), [fixture evidence](data/coverage-notes.json), and [metadata overrides](data/player-overrides.json).

## Ratings and simulation

- **Batter.** A documented batting role or at least 36 balls and an average batting position of 7.5 or higher up the order.
- **Wicketkeeper.** A match-specific keeper designation or a recorded stumping in the drawn window. The keeper rating uses both batting and verified keeping dismissals per match, compared with the corresponding seasons. The keeping term uses a 12-match prior and includes only scorecard-designated appearances in its rate.
- **All-rounder.** At least 60 balls faced and 60 legal balls bowled, with an average batting position of 8 or higher up the order. The rating gives batting and bowling equal base weight and also uses the difference between their averages.
- **Spinner or pacer.** At least 48 legal balls bowled and a documented style. The spinner rating emphasizes middle overs and the pacer rating emphasizes the death.

Powerplay uses the recorded mandatory powerplay when available. A standard innings uses overs 1–6, 7–15, and 16–20. Batting compares runs and dismissals per ball against eligible peers in the same season, phase, and batting-position band. Bowling uses charged runs, credited wickets, and scoreless legal deliveries. The model values a dismissal at five runs and a dot above expectation at 0.7 runs. A phase with no peer deliveries uses the league benchmark for that season and phase. Small samples are pulled toward average. Super overs are excluded from ball-by-ball ratings.

Season scores give linear volume credit for runs (0.055 each), wickets (0.9), verified keeper dismissals (0.55), and matches (0.4), before the role weights. All-rounders split their run and wicket credit evenly and retain the stabilized batting-minus-bowling average adjustment. Each season score is centered against eligible peers for that role. The cycle score sums those margins and divides by the square root of seasons played. On the display scale, 60 represents neutral performance, and roughly the top 8% of each role and cycle score 90 or above.

Fielding adds 0.75 season-score points per recorded catch, plus six times the extra catches per full fielding innings after an eight-innings cushion. The same-season benchmark uses catches by listed fielders. Recorded Impact Player swaps adjust the share of legal balls each player was on the field. The simulator applies a smaller fielding contribution to runs saved. Caught-and-bowled dismissals count as catches. Keeper dismissals are credited separately, and ambiguous catches by known keepers are skipped when scorecards are unavailable. The data records completed catches without a difficulty grade.

CSK Dhoni is a regression check. His **2014–2017** line is **743 runs off 555 balls in 33 matches**, rated **79 as a batter and 90 as keeper**. His **2025–2026** line is **196 off 145 in 14 matches**, rated **54 and 52**. The newer window has a slightly higher raw strike rate. The older window's death-overs scoring was **21.8 runs above** its season and position benchmarks, with **13.5 fewer dismissals** than expected across **309 balls**. In the newer window the corresponding figures are **6.4 runs below** and **2.9 fewer dismissals** over **116 balls**. The older window earns more credit for batting and keeping volume relative to its seasonal peers.

The simulator compares full-innings scores for a fixed schedule of 14 opponent and venue profiles. Historical phase edges apply to expected workload for the assigned batting positions and bowling jobs. Openers and finishers can add a small complement bonus, middle-overs spin benefits more on turning surfaces, and a pacer's death edge matters more at pace-friendly venues. A uniform scoring adjustment keeps the perfect-season rate close to the previous model after automatic placement. The opponent strength, venue par, wicket value, and random scoring variation are game-model assumptions. The results page shows the final win–loss record and a Retry game button.

## Verification

`node --test` covers both respins, blocked respins, duplicate prevention, the overseas cap, slot feasibility, 30 complete historical drafts, automatic batting assignment, the 2026 final, the Dhoni check, and same-seed repeatability. The UI event-handler test exercises a complete draft, the batting XI, and results rendering with a DOM adapter. Synthetic fixtures exist only in the edge-case unit test.

The balance batch uses 60 seeded drafts per strategy and 100 shared season seeds per draft. The balanced strategy prioritizes strong role ratings and batting phase strengths. The weaker strategy prioritizes low role ratings. All strategies use the same automatic batting assignment.

| Strategy | Seasons | Average wins | 14–0 |
| --- | ---: | ---: | ---: |
| Balanced | 6,000 | 10.48 | 173 (2.88%) |
| Random | 6,000 | 5.03 | 0 |
| Weaker | 6,000 | 1.47 | 0 |

The previous fixed-slot model produced 171 perfect seasons (2.85%) for the same balanced drafts and seeds.

