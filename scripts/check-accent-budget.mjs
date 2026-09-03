// Battery for lib/kit/accent-budget.ts.
//
// The module's claim is that a cheap shell can read as architecture if a small
// accent budget is spent where a camera points. These checks exist to stop that
// claim degrading into decoration: the ranking must stay honest about which
// moves actually cost money, the factory/site split must follow from each
// move's own locus rather than from a hopeful constant, and the elevation
// question must keep pointing at the answer that does not forfeit the unit class.
//
// Usage: node scripts/check-accent-budget.mjs (npm run check:accent-budget)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  OBSERVED_TARIFF, ANSI_LIVING_AREA_CAP_SQFT, ratePerSqFtNight, observedFitsParkModelClass,
  ACCENT_MOVES, leverage, rankedAccents, factoryFraction, offCameraSpend,
  assessElevation, DETACHED_WELLNESS, HERO_FRAME,
} = await import(join(root, 'lib/kit/accent-budget.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}

console.log('the observed tariff — the anchor, with its numbers pinned');
// Pinned tightly at both ends. A drift in either direction breaks the argument
// the module is built on, so neither a ceiling nor a floor alone is enough.
check('the observed unit is 398 sq ft',
  OBSERVED_TARIFF.floorAreaSqFt === 398);
check('and that is inside the ANSI living-area cap, not merely near it',
  ANSI_LIVING_AREA_CAP_SQFT === 400 && OBSERVED_TARIFF.floorAreaSqFt < ANSI_LIVING_AREA_CAP_SQFT
  && observedFitsParkModelClass() === true);
check('the nightly rate is the listing figure, with the lower aggregator figure kept',
  OBSERVED_TARIFF.nightlyRateUsd === 870 && OBSERVED_TARIFF.lowestSeenRateUsd === 774
  && OBSERVED_TARIFF.lowestSeenRateUsd < OBSERVED_TARIFF.nightlyRateUsd);
check('the rate per sq ft per night comes out at 2.19',
  ratePerSqFtNight() === 2.19, String(ratePerSqFtNight()));
// Exercising the function with figures it has never seen is the only way to
// tell a derivation from a constant. A hardcoded 2.19 passes the line above
// and fails every line below.
check('and it is genuinely DERIVED, not a stored constant',
  ratePerSqFtNight(1000, 500) === 2 && ratePerSqFtNight(300, 400) === 0.75
  && ratePerSqFtNight(870, 199) === 4.37);
check('the ratio moves the right way with each input',
  ratePerSqFtNight(1740, 398) > ratePerSqFtNight(870, 398)
  && ratePerSqFtNight(870, 796) < ratePerSqFtNight(870, 398));
check('and a zero footprint does not divide by zero',
  ratePerSqFtNight(870, 0) === 0);
check('the lower aggregator rate yields a lower ratio on the same footprint',
  ratePerSqFtNight(OBSERVED_TARIFF.lowestSeenRateUsd) < ratePerSqFtNight());
check('it sleeps two — the revenue is not coming from occupancy',
  OBSERVED_TARIFF.maxGuests === 2);
check('and what is NOT known is recorded, so the margin is not assumed',
  OBSERVED_TARIFF.unresolved.length >= 2
  && OBSERVED_TARIFF.unresolved.some((u) => /construction method not published/.test(u))
  && OBSERVED_TARIFF.unresolved.some((u) => /build cost not published/.test(u)));

console.log('the accent ranking — honest about which moves cost money');
const ranked = rankedAccents();
check('every move is ranked, none dropped',
  ranked.length === ACCENT_MOVES.length && ranked.length === 8, String(ranked.length));
check('the ranking is actually sorted by leverage, descending',
  ranked.every((m, i) => i === 0 || leverage(ranked[i - 1]) >= leverage(m)));
// The interesting result, and the one most likely to be quietly "fixed": the
// three best-leverage moves are the nearly-free ones, and the glass is NOT
// among them. If a future edit promotes the glass, the ranking has stopped
// measuring and started flattering.
check('the top three moves all cost little and gain much',
  ranked.slice(0, 3).every((m) => m.buildCost === 'low' && m.perceivedGain === 'high'));
check('and they are the cantilever, the dark cladding and the exposed timber',
  ranked.slice(0, 3).map((m) => m.id).sort().join(',')
  === 'cantilevered-deck-edge,dark-monolithic-cladding,exposed-timber-undercroft');
check('the glazed gable ranks BELOW them — it is the part that costs',
  leverage(ACCENT_MOVES.find((m) => m.id === 'glazed-gable'))
  < leverage(ACCENT_MOVES.find((m) => m.id === 'cantilevered-deck-edge')));
check('leverage penalises upkeep, not just build cost',
  leverage({ perceivedGain: 'high', buildCost: 'low', maintenanceCost: 'high' })
  < leverage({ perceivedGain: 'high', buildCost: 'low', maintenanceCost: 'low' }));

console.log('the factory split — the metric the programme is actually about');
const siteOnly = ACCENT_MOVES.filter((m) => m.locus === 'site');
check('three quarters of the accents can be factory-built',
  factoryFraction() === 0.75, String(factoryFraction()));
check('and the exceptions are exactly the two that must follow the ground',
  siteOnly.length === 2
  && siteOnly.map((m) => m.id).sort().join(',') === 'boardwalk-approach,exposed-timber-undercroft');
check('the fraction is computed from each move\'s own locus',
  factoryFraction(ACCENT_MOVES.filter((m) => m.locus === 'site')) === 0
  && factoryFraction(ACCENT_MOVES.filter((m) => m.locus === 'factory')) === 1);
check('and an empty selection does not divide by zero',
  factoryFraction([]) === 0);
check('the skylight is factory-fit only, because a site cut-in is the leak',
  ACCENT_MOVES.find((m) => m.id === 'skylight-over-bed').locus === 'factory'
  && /Factory-fit it or do not fit it/.test(ACCENT_MOVES.find((m) => m.id === 'skylight-over-bed').consequence));

console.log('off-camera spend — flagged, not forbidden');
const offCam = offCameraSpend();
check('interior hard finishes are flagged as off-camera spend',
  offCam.length === 1 && offCam[0].id === 'interior-hard-finishes');
check('but the cheap off-camera moves are NOT flagged',
  !offCam.some((m) => m.id === 'skylight-over-bed')
  && !offCam.some((m) => m.id === 'boardwalk-approach'));
check('nothing on camera is ever flagged as off-camera spend',
  offCam.every((m) => m.visibleInHeroFrame === false));
// A move that is expensive, invisible AND weakly valuable would be pure waste.
check('no accent is high-cost, off-camera and low-gain at once',
  !ACCENT_MOVES.some((m) => m.buildCost === 'high' && !m.visibleInHeroFrame && m.perceivedGain !== 'high'));

console.log('every accent carries its consequence, or says there is none');
check('all eight declare a consequence field explicitly',
  ACCENT_MOVES.length === 8
  && ACCENT_MOVES.every((m) => typeof m.consequence === 'string' || m.consequence === null));
check('the glazing accent admits fixed glass is not egress',
  /not egress/.test(ACCENT_MOVES.find((m) => m.id === 'glazed-gable').consequence)
  && /R310/.test(ACCENT_MOVES.find((m) => m.id === 'glazed-gable').consequence));
check('the cantilever accent points at the function, not at a number',
  /maxWoodOverhangFt\(\)/.test(ACCENT_MOVES.find((m) => m.id === 'cantilevered-deck-edge').consequence)
  && /do not eyeball it/.test(ACCENT_MOVES.find((m) => m.id === 'cantilevered-deck-edge').consequence));
check('the undercroft accent names the post sizes and the 30 in cliff',
  /4x4 only to 8 ft, 6x6 to 20 ft/.test(ACCENT_MOVES.find((m) => m.id === 'exposed-timber-undercroft').consequence)
  && /30 in/.test(ACCENT_MOVES.find((m) => m.id === 'exposed-timber-undercroft').consequence));
check('the cladding accent insists on stain over paint, with the reason',
  /Stain, never paint/.test(ACCENT_MOVES.find((m) => m.id === 'dark-monolithic-cladding').consequence)
  && /peels/.test(ACCENT_MOVES.find((m) => m.id === 'dark-monolithic-cladding').consequence));

console.log('elevation — the tension this aesthetic creates, and the way through it');
const liftUnit = assessElevation('lift-the-unit');
const liftDeck = assessElevation('lift-the-deck');
check('lifting the unit forfeits the vehicle reading',
  liftUnit.preservesVehicleReading === false && liftUnit.recommended === false);
check('and says why — affixed, chassis carrying nothing, real lateral engineering',
  /chassis carries nothing/.test(liftUnit.mechanism) && /permanently affixed/.test(liftUnit.mechanism)
  && /lateral design/.test(liftUnit.mechanism));
check('lifting the DECK keeps the unit class and is the recommendation',
  liftDeck.preservesVehicleReading === true && liftDeck.recommended === true);
check('and it claims the same photograph, by putting the camera below',
  /Same photograph/.test(liftDeck.mechanism) && /cut pad/.test(liftDeck.mechanism)
  && /Cut the pad, do not lift the box/.test(liftDeck.mechanism));
// The coupling is the point: the recommended strategy must be the one that
// keeps the unit class. If those two ever come apart, the module is advising
// against its own reasoning.
check('exactly one strategy is recommended',
  [liftUnit, liftDeck].filter((a) => a.recommended).length === 1);
check('and it is the one that preserves the vehicle reading',
  [liftUnit, liftDeck].every((a) => a.recommended === a.preservesVehicleReading));
check('both strategies trigger guards and lateral work — height does that, not choice',
  liftUnit.triggersGuardsAndLateral === true && liftDeck.triggersGuardsAndLateral === true);

console.log('the detached wellness circuit, and the frame the money is aimed at');
check('the detached spa is recorded as observed, with four reasons it works',
  DETACHED_WELLNESS.observedAt === OBSERVED_TARIFF.name
  && OBSERVED_TARIFF.wellnessIsDetached === true
  && DETACHED_WELLNESS.whyItWorks.length === 4);
check('it defers the tax treatment instead of deciding it',
  /tax workstream/.test(DETACHED_WELLNESS.caution) && /39-year improvement/.test(DETACHED_WELLNESS.caution));
check('the hero frame names the orientation rule the accents depend on',
  /view side/.test(HERO_FRAME.consequence) && /downhill corner/.test(HERO_FRAME.consequence)
  && /halves the photograph and doubles the cost/.test(HERO_FRAME.consequence));
check('and the glass and the cantilever are required to share an elevation',
  /glass and the cantilever go on the view side, together/.test(HERO_FRAME.consequence));

if (failures > 0) { console.error(`\naccent-budget battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\naccent-budget battery clean');
