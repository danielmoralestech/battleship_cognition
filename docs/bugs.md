# Battleship: bugs found and how they were fixed

How each bug was found:

- **Review:** automated Devin Review on the PR.
- **Testing:** recorded UI test runs.
- **CI:** GitHub Actions.
- **Build:** found while building the feature.
- **Measurement:** found by measuring page overflow at iPhone screen sizes.
- **User report:** reported by the project owner.

PR links go to https://github.com/danielmoralestech/battleship_cognition/pull/N.

## Summary

40 bugs resolved across PRs #3–#26. No known bugs are open.

| Area                                | Resolved |
| ----------------------------------- | -------- |
| Fleet placement and controls        | 5        |
| Battle screen and layout            | 12       |
| Effects, 3D and timing              | 11       |
| Battle log, Settings, sound and aim | 10       |
| Ops                                 | 2        |
| **Total**                           | **40**   |

| Found by    | Count |
| ----------- | ----- |
| Review      | 17    |
| Testing     | 6     |
| Build       | 5     |
| User report | 4     |
| CI          | 4     |
| Measurement | 4     |

## Fleet placement and controls

| Bug                                                                                                                     | Found by       | Fix                                                                                                                                                     | PR      |
| ----------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Dragging a placed ship and cancelling it (Esc, or letting go off the board) deleted the ship and disabled Start battle  | Review         | Replaced HTML5 drag-and-drop with Pointer Events. The ship now stays put until a valid drop, and a cancelled gesture restores it                        | #3 → #4 |
| HTML5 drag-and-drop didn't work on iPhone, and touch-dragging scrolled the whole page                                   | User report    | Pointer Events drag with `touch-action: none` on the setup board, so the page doesn't scroll during placement                                           | #4      |
| The scroll wheel didn't rotate ships on mice that scroll by page                                                        | Review         | Page-mode wheel deltas are scaled by board height, so they count toward a rotation                                                                      | #11     |
| Mostly sideways trackpad swipes didn't rotate                                                                           | Review         | Uses the larger of the two wheel axes                                                                                                                   | #11     |
| A touch drag along the top row removed the ship. The aim point floats 1.25 cells above the finger, so it left the board | Review (on #4) | When the lifted point is above the board but the finger is on it, aim at row 1. A ship is removed only when the finger itself is released off the board | #24     |

## Battle screen and layout

| Bug                                                                                                                 | Found by    | Fix                                                                                                           | PR  |
| ------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- | --- |
| The two boards overflowed narrow phones held sideways (742px of content on a 667px screen)                          | Review      | Board width is also capped by viewport width                                                                  | #5  |
| "Your fleet" couldn't be opened after the game ended                                                                | Review      | The sheet now opens in any phase, not just mid-battle                                                         | #5  |
| Battle log missing in landscape                                                                                     | Build       | Collapsible log added to the landscape layout                                                                 | #5  |
| A stray blank line failed the formatting check on main                                                              | CI          | Ran Prettier                                                                                                  | #6  |
| A phone held sideways scrolled 2–46px. Cause: a desktop bottom margin (`sm:pb-12`) applied to wide landscape phones | Measurement | Smaller bottom padding in landscape. The full header buttons need ≥768px, and narrower screens use the ⋯ menu | #23 |
| The 4-inch iPhone SE scrolled 62px because the header and turn text each wrapped onto 2 lines                       | Measurement | Smaller title, no ⚓, smaller turn text and pill below 360px                                                  | #23 |
| The Aim-before-fire Fire button added up to 114px of scrolling                                                      | Measurement | The button moved beside the fleet mini-map (portrait) and became compact (landscape)                          | #23 |
| Placing ships sideways: the 412px board was taller than the 342px screen, and the sticky bar covered rows 2–3       | Measurement | Two-column landscape setup with the board sized to the screen height and the controls beside it               | #23 |
| On a short, narrow landscape screen (667×500), the colour picker ran off the right edge                             | Review      | The board is also capped by `100vw − 23.5rem`                                                                 | #23 |
| On very small landscape screens (<568px wide), the board shrank to almost nothing                                   | Review      | These screens fall back to the stacked layout                                                                 | #23 |
| 4-inch SE: the page scrolled 7px once accuracy reached two or three digits, because the stats wrapped               | Testing     | Compact stats wording below 360px                                                                             | #23 |
| 4-inch SE: the Rematch label was cut off on the Victory screen                                                      | Testing     | Tighter modal and button padding below 360px                                                                  | #23 |

## Effects, 3D and timing

| Bug                                                                                               | Found by | Fix                                                                                                            | PR  |
| ------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- | --- |
| 3D showed a shot's result before its shell landed                                                 | Build    | Every queued shot is hidden until its shell lands                                                              | #8  |
| The 3D chunk was downloaded even without WebGL2                                                   | Build    | Prefetch is skipped when WebGL2 is unavailable                                                                 | #8  |
| With Reduce Motion on, every 3D shot logged React duplicate-key errors                            | Testing  | Shot landing is idempotent (StrictMode double effect)                                                          | #8  |
| Turning on Reduce Motion mid-game didn't stop the shot effects or dim the sink flash until reload | Testing  | Reduced motion is checked per shot and per flash                                                               | #9  |
| The full-game iPhone test timed out in CI with effects on (no GPU)                                | CI       | Lighter burning and radar layers. The smoke test runs with reduced motion, and the effects have their own test | #9  |
| If the 3D view failed to load, the saved preference stayed on 3D                                  | Build    | A failed switch saves 2D again                                                                                 | #10 |
| Wrecks were missing for restored games and with Reduce Motion, since no shell plays               | Build    | These wrecks show straight away                                                                                | #13 |
| In 3D, the last wreck and the Victory dialog appeared before the final shell landed               | Testing  | The scene reports landed shells. The reveal and the dialog wait for the last one                               | #19 |
| Dark fleet colours were invisible on the submarine                                                | Review   | Light rim behind the submarine accents                                                                         | #16 |
| A saved colour like `toString` was accepted as valid                                              | Review   | Only own keys of the palette are accepted                                                                      | #16 |
| Wrecks dimmed only the hull stripe, not all team accents                                          | Review   | All accents dim                                                                                                | #16 |

## Battle log, Settings, sound and aim

| Bug                                                                                                                             | Found by       | Fix                                                                                                                               | PR  |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- | --- |
| In 3D, with the log open, tapping the bottom bar triggered its controls                                                         | Review         | The 3D log backdrop sits above the bottom bar                                                                                     | #18 |
| In 3D, with the log open, tapping the ⋯ menu or Restart triggered them                                                          | Testing        | The first tap only closes the log                                                                                                 | #20 |
| The first fix left Review and Rematch dead for one click if the AI ended the game while the log was open                        | Review         | Dialogs that open over the log receive clicks                                                                                     | #20 |
| The wheel-burst placement test failed on slow CI runners                                                                        | CI             | The test no longer depends on runner speed                                                                                        | #20 |
| Turning Sound on made the enemy's next shot silent                                                                              | Review         | Audio unlocks on the first tap even while Sound is off                                                                            | #21 |
| Tab could move focus out of the Settings dialog                                                                                 | Review         | Focus loops inside the dialog                                                                                                     | #21 |
| Toggling Aim before firing off and on brought the old crosshair back, so the next tap fired                                     | Review         | Switching Aim off forgets the aim                                                                                                 | #22 |
| The iPhone full-game test hit the 60s limit on CI                                                                               | CI             | Marked `test.slow()`                                                                                                              | #23 |
| With `announceSinks: false`, the bubble and log would still name sunk ships. This couldn't happen, since the rule was always on | Review (on #3) | Removed the unused `announceSinks` option                                                                                         | #24 |
| In 3D, the Aim-before-fire Fire button was too small on iPhone (78×28px) and sat at the far right of the bottom bar             | User report    | Upright: a 320×48 button centred above the status bar. Sideways and desktop: 160×44, in the middle of the bar, on a solid backing | #25 |

## Ops

| Bug                                                                          | Found by    | Fix                                                                                                                                                                            | PR          |
| ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| The Pages deploy for #21 failed 3 times: GitHub timed it out or cancelled it | User report | A fresh deploy from main succeeded. Build and tests had passed every time                                                                                                      | #21 (rerun) |
| The Pages deploy warned "Node.js 20 is deprecated" for `deploy-pages@v4`     | User report | Moved every action to its Node 24 version (checkout v6, setup-node v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5). The next deploy ran without the warning | #26         |

## Real iPhone check

- The project owner ran a manual checklist in Safari on a real iPhone after #24 and #25 went live, and reported everything working. That covered placement and dragging, the sideways layouts, sound and the silent switch, Aim before firing, the end of a game, and the optional VoiceOver and 3D steps.
