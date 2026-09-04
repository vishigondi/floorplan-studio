// Battery for lib/kit/site-composition.ts.
//
// Only units with a full-height glass wall are in play, so the glazing — not the
// door — is now the governing constraint. These checks hold three claims still:
// that the glass wall's position dictates which arrangements exist, that a unit
// which cannot be towed out is not a vehicle, and that a glass wall pointed at
// another unit is not a view.
//
// Usage: node scripts/check-site-composition.mjs (npm run check:site-composition)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const M = await import(join(root, 'lib/kit/site-composition.ts'));
const {
  OBSERVED_UNITS, glassUnits, oneDeckServesBoth, MIRRORING_BY_MAKER, PERMIT_FREE_WIDTH_FT,
  SKIRTING_IS_DELEGATED, LAYOUTS, layoutById, unitCorners, lengthAxis, polysOverlap,
  towSweep, checkTowEgress, layoutTowsClear, minGapFt, MIN_SEPARATION_FT,
  TOW_SIDE_CLEARANCE_FT, TOW_EXIT_RUN_FT, doorFacing, doorPoint, pointInPolygon,
  doorOpensOntoDeck, everyDoorLands, glassFacing, glassPoint, glassReachFt, glassWidthFt,
  glassOpensOntoDeck, glassHasView, everyGlassWorks, viewCorridor, VIEW_CLEAR_FT,
  deckAreaSqFt, flankStripCostSqFt, FLANK_STRIP_WIDTH_FT, mirroredUnits, requiresMirroring,
  isOrthogonal, ORTHOGONAL_ONLY, PAD_SPEC, PROHIBITED_FOUNDATIONS, foundationAllowed,
  DELIVERY_ACCESS, cornerClearanceFt, cornerSavingFt, CUSTOMISATION, customisationAvailableAt,
  NEAR_MISSES, SURVEY, OOD_CLASSIFICATION_CONFLICT, UNVERIFIED, FOLDING_DOOR_UNITS,
  CERTIFICATION_BODIES, NC_LABEL_QUESTION, DESIGN_PLUS_BUILDER, WIND_RIVER, OOD_OFFICE_UNITS,
  OTHER_AGENCIES, CERT_TO_TITLE_CHAIN,
} = M;
const { loftCountsTowardArea } = await import(join(root, 'lib/kit/nc-classification.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}
const near = (a, b, tol = 0.01) => Math.abs(a - b) < tol;
const area = (pts) => Math.abs(pts.reduce((a, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return a + (p.x * q.y - q.x * p.y);
}, 0) / 2);

console.log('geometry primitives — checked against answers known by hand');
const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
check('overlap, separation and containment all read correctly',
  polysOverlap(sq, [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }]) === true
  && polysOverlap(sq, [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 10 }]) === false
  && polysOverlap(sq, [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }]) === true);
// A deck butted to a unit shares an edge. If that read as an obstruction every
// sane layout would fail.
check('shapes sharing one edge are touching, not overlapping',
  polysOverlap(sq, [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }]) === false);
check('point-in-polygon agrees inside, outside and to the left',
  pointInPolygon({ x: 5, y: 5 }, sq) && !pointInPolygon({ x: 15, y: 5 }, sq)
  && !pointInPolygon({ x: -1, y: 5 }, sq));
const u0 = { id: 'T', model: 't', widthFt: 12, lengthFt: 42, at: { x: 0, y: 0 }, rotDeg: 0,
  entry: 'side', hitch: 'far-end', doorAtFractionFromGlass: 0.5, glassWall: 'gable' };
check('rotation moves a unit without resizing it',
  [0, 17, 90, 244].every((d) => near(area(unitCorners({ ...u0, rotDeg: d })), 12 * 42, 0.001)));
check('the tow sweep is the unit plus clearance and a run for the tractor',
  TOW_SIDE_CLEARANCE_FT === 2 && TOW_EXIT_RUN_FT === 25
  && near(area(towSweep(u0)), (12 + 4) * (42 + 25), 0.01));

console.log('only units with a full-height glass wall are in the catalogue');
check('eight models in play, each with its own source',
  OBSERVED_UNITS.length === 8 && glassUnits().length === 8
  && OBSERVED_UNITS.every((u) => typeof u.source === 'string' && u.source.includes('.com')));
check('six put the glass on the gable — the long wall is the towing face',
  OBSERVED_UNITS.filter((u) => u.glassWall === 'gable').length === 6);
check('and two put it on the long side',
  OBSERVED_UNITS.filter((u) => u.glassWall === 'side').map((u) => u.maker).sort().join()
  === ['Irontown Modular', 'ÖÖD'].sort().join());
// Two ways in, and they must not be confusable. Five rest on the maker's own
// published words; two are in on instruction with the wall assumed.
const published = OBSERVED_UNITS.filter((u) => u.evidenceStatus === 'published');
const directed = OBSERVED_UNITS.filter((u) => u.evidenceStatus === 'owner-directed');
check('six rest on published evidence, two are in on instruction',
  published.length === 6 && directed.length === 2
  && directed.every((u) => u.maker === 'Irontown Modular'));
const WALL = /glass wall|window wall|facade|Full glass|entire front|A-frame glass/i;
const byQuote = published.filter((u) => !u.windowSchedule);
const bySchedule = published.filter((u) => u.windowSchedule);
check('published evidence comes as a maker quote or a window schedule, nothing weaker',
  byQuote.length === 5 && bySchedule.length === 1
  && byQuote.length + bySchedule.length === published.length);
check('each quote-evidenced unit names a wall, facade or glazed gable, in the maker\'s words',
  byQuote.every((u) => u.glassEvidence.length > 40 && u.glassEvidence.includes('"')
    && WALL.test(u.glassEvidence)),
  byQuote.filter((u) => !WALL.test(u.glassEvidence)).map((u) => u.model).join());
check('and the schedule-evidenced unit cites tags instead of marketing',
  bySchedule.every((u) => /WINDOW SCHEDULE, not marketing/.test(u.glassEvidence)
    && u.windowSchedule.some((w) => /FX/.test(w))));
// The check that stops an assumption quietly becoming a fact: an owner-directed
// unit must SAY it is unpublished, and must not read as if a maker said it.
// The floor plans came back and they say no. That answer has to survive in the
// record, or the units quietly read as qualifying next time someone opens this.
// CORRECTED. A plan view with no window schedule cannot support "fails the
// bar" — it shows where openings are, not how big. This record made that claim
// and it has been withdrawn to an open question.
check('both owner-directed units say the extent is NOT DETERMINABLE, not that it fails',
  directed.every((u) => /NOT DETERMINABLE FROM THE PUBLISHED PLAN/.test(u.glassEvidence)
    && !/FAILS THE GLASS-WALL BAR/.test(u.glassEvidence)));
check('and each says why the plan cannot settle it',
  directed.every((u) => /no window schedule|carries no window schedule/i.test(u.glassEvidence)));
check('and each frames it as an open question rather than a settled negative',
  directed.every((u) => /open question, not a settled negative/.test(u.glassEvidence)));
check('and each still records the folding door the plan DOES show',
  directed.every((u) => /OPTIONAL folding door/.test(u.glassEvidence)));
check('the first open question now asks for the window schedule',
  directed.every((u) => /Send the window schedule/.test(u.openQuestions[0])));
check('their sources cite the floor plan PDF, not the marketing page alone',
  directed.every((u) => /floor plan PDF/.test(u.source)));

console.log('a window schedule is the only hard evidence of glazing extent');
const sky = OBSERVED_UNITS.find((u) => u.model === 'Skyview 400');
check('the evidence ranking puts a window schedule above prose and a rendering',
  SURVEY.evidenceRank[0] === 'window schedule'
  && SURVEY.evidenceRank.indexOf('plan view') > SURVEY.evidenceRank.indexOf('maker prose')
  && SURVEY.evidenceRank[SURVEY.evidenceRank.length - 1] === 'rendering');
check('and the ranking names the mistake it exists to prevent',
  /could not support/.test(String(SURVEY.evidenceRank) + '') === false);
check('Skyview is the only unit carrying a decoded window schedule',
  OBSERVED_UNITS.filter((u) => u.windowSchedule).map((u) => u.model).join() === 'Skyview 400'
  && sky.windowSchedule.length === 4);
check('its tall light is read as 9 ft, from the 3090FX tag',
  /3090FX/.test(sky.windowSchedule[0]) && /9 ft TALL/.test(sky.windowSchedule[0])
  && /nine-foot-tall/.test(sky.glassEvidence));
// The honest distinction: tall is not the same as wide.
check('and it is described as full HEIGHT, not full width',
  /Full HEIGHT/.test(sky.glassEvidence) && /not one uninterrupted pane/.test(sky.glassEvidence));
check('its integrated porch is 11 of the 44 ft overall, built at the factory',
  sky.integratedPorchFt === 11 && /factory/.test(sky.factoryPorch));
// CORRECTED. This check previously asserted the loft was free of the cap. It
// is not, in North Carolina: NCDOI counts a habitable loft (5 ft or more of
// ceiling) inside the gross trailer area. The check now guards the correction
// rather than the error it replaced.
check('the loft is NOT claimed to be free of the area cap',
  !/excluded from the ANSI living-area cap/.test(sky.entryNote)
  && /CORRECTED/.test(sky.entryNote)
  && /counts against the 400/.test(sky.entryNote));
check('and it points at the module holding the state\'s wording',
  /nc-classification\.ts/.test(sky.entryNote));
// What the plans DO show, kept as its own fact rather than a consolation.
check('both offer a folding door onto a covered deck at the living end',
  FOLDING_DOOR_UNITS.length === 2
  && FOLDING_DOOR_UNITS.every((u) => u.foldingDoorToDeck === true
    && /covered deck at the living end/.test(u.factoryPorch)));
check('and no published-evidence unit claims a folding door',
  published.every((u) => u.foldingDoorToDeck === undefined));
// The Cabana's real advantage, straight off the plan.
check('the Cabana entry sits far closer to the deck end than any A-frame',
  OBSERVED_UNITS.find((u) => u.model === 'Cabana PMRV').doorAtFractionFromGlass === 0.4
  && OBSERVED_UNITS.filter((u) => /A-Frame/.test(u.model))
      .every((u) => u.doorAtFractionFromGlass > 0.7));
check('the Mysa footprint is corrected from the web page to the plan',
  OBSERVED_UNITS.find((u) => u.model === 'Mysa 400').lengthFt === 32.17
  && /"14 x 32" is wrong/.test(OBSERVED_UNITS.find((u) => u.model === 'Mysa 400').entryNote));
check('each owner-directed unit carries its open questions, glazing first',
  directed.every((u) => Array.isArray(u.openQuestions) && u.openQuestions.length >= 4
    && /Send the window schedule/.test(u.openQuestions[0])
    && /glazing extent is unknown/.test(u.openQuestions[0])));
check('and published units carry none, so the two states stay distinguishable',
  published.every((u) => u.openQuestions === undefined));
// The Cabana's factory deck is the only real geometric evidence there is.
check('the Cabana\'s factory deck is recorded as an END deck, from its own dimensions',
  /adds six feet of length/.test(OBSERVED_UNITS.find((u) => u.model === 'Cabana PMRV').entryNote)
  && /at the LIVING END/.test(OBSERVED_UNITS.find((u) => u.model === 'Cabana PMRV').entryNote));
check('two put it on the long side, and they are the two with deck-side entry',
  OBSERVED_UNITS.filter((u) => u.glassWall === 'side').map((u) => u.model).sort().join()
  === 'Extended Park Model RV,Skyview 400');
// The geometric consequence that shapes every layout below.
check('every gable-glass unit has its door on a DIFFERENT wall from its glass',
  OBSERVED_UNITS.filter((u) => u.glassWall === 'gable').every((u) => u.glassSplitFromDoor === true));
// One deck serving both is a property of the side-glass units, not a brand.
check('one deck serves both exactly where the glass and door share a wall',
  OBSERVED_UNITS.filter(oneDeckServesBoth).map((u) => u.model).sort().join()
  === 'Extended Park Model RV,Skyview 400'
  && OBSERVED_UNITS.every((u) => oneDeckServesBoth(u) === (u.glassWall === 'side')));
check('the A-frame doors sit near the hitch end, not centred on the wall',
  OBSERVED_UNITS.filter((u) => /A-Frame/.test(u.model)).every((u) => u.doorAtFractionFromGlass >= 0.75));
check('no unit in the catalogue tows permit-free — all exceed 8.5 ft',
  PERMIT_FREE_WIDTH_FT === 8.5 && OBSERVED_UNITS.every((u) => u.towsPermitFree === false)
  && OBSERVED_UNITS.every((u) => u.widthFt > PERMIT_FREE_WIDTH_FT));
// Luna's caveat is now specific rather than generic, so count the warnings
// rather than one phrase — the point is that no door position is silently assumed.
check('every unresolved door position carries a warning, none silently assumed',
  OBSERVED_UNITS.filter((u) => /⚠️/.test(u.entryNote)).length === 3
  && /not published/.test(OBSERVED_UNITS.find((u) => u.maker === 'ÖÖD').entryNote)
  && /may be far closer to the deck/.test(OBSERVED_UNITS.find((u) => u.model === 'Luna').entryNote));
check('and the mirror glazing carries its own warnings',
  /bird-strike/.test(OBSERVED_UNITS.find((u) => u.maker === 'ÖÖD').entryNote)
  && /mirror whatever stands in front/.test(OBSERVED_UNITS.find((u) => u.maker === 'ÖÖD').entryNote));

console.log('what was looked at and rejected, and why');
// The summary must be derived from the data it summarises, or it drifts.
check('the survey counts match the catalogue they describe',
  SURVEY.qualified === OBSERVED_UNITS.length && SURVEY.rejected === NEAR_MISSES.length
  && SURVEY.evidencePublished === published.length
  && SURVEY.evidenceOwnerDirected === directed.length
  && SURVEY.evidencePublished + SURVEY.evidenceOwnerDirected === SURVEY.qualified);
check('and the makers it names are exactly the makers in the catalogue',
  SURVEY.makersQualified.slice().sort().join()
  === [...new Set(OBSERVED_UNITS.map((u) => u.maker))].sort().join());
check('seven near-misses recorded, each with a reason',
  NEAR_MISSES.length === 7 && NEAR_MISSES.every((n) => n.why.length > 60));

console.log('the certifying bodies — a membership label and an agency label, one standard');
check('five bodies recorded, each with its standard and how you get it',
  CERTIFICATION_BODIES.length === 5
  && CERTIFICATION_BODIES.every((b) => b.standard.length > 5 && b.howYouGetIt.length > 20));
// The correction: the distinction is who issues the label, not quality.
check('RVIA is recorded as an ASSOCIATION requiring membership',
  CERTIFICATION_BODIES.find((b) => b.body === 'RVIA').kind === 'industry association'
  && /Membership/.test(CERTIFICATION_BODIES.find((b) => b.body === 'RVIA').howYouGetIt));
check('and PWA as an INDEPENDENT AGENCY, not a lesser certification',
  /independent third-party/.test(CERTIFICATION_BODIES.find((b) => /PWA/.test(b.body)).kind)
  && /in-plant inspections/.test(CERTIFICATION_BODIES.find((b) => /PWA/.test(b.body)).howYouGetIt));
check('both certify to the same standard',
  CERTIFICATION_BODIES.find((b) => b.body === 'RVIA').standard
    .includes('ANSI A119.5')
  && CERTIFICATION_BODIES.find((b) => /PWA/.test(b.body)).standard.includes('ANSI A119.5'));
check('exactly two are pictured in the NC memo',
  CERTIFICATION_BODIES.filter((b) => b.ncMemoPicturesIt).map((b) => b.body).sort().join()
  === 'RPTIA,RVIA');

console.log('what NC has actually settled, and what it has not');
check('what is settled is stated narrowly — pictured labels, temporary use',
  /pictured as acceptable for temporary use/.test(NC_LABEL_QUESTION.settled));
// The honest position: the memo neither pictures nor clearly excludes PWA.
check('and the open question is framed as open in BOTH directions',
  /pictures neither/.test(NC_LABEL_QUESTION.open)
  && /cannot certify AT ALL/.test(NC_LABEL_QUESTION.open));
check('with the question written to get a LIST, not a one-builder answer',
  /maintain a LIST of accepted third-party certification agencies/.test(NC_LABEL_QUESTION.askThis)
  && /rather than naming one agency/.test(NC_LABEL_QUESTION.askThis)
  && /California HCD/.test(NC_LABEL_QUESTION.askThis));

console.log('the agency landscape, and what certification is actually for');
check('five more accredited agencies recorded beyond RVIA and PWA',
  OTHER_AGENCIES.length === 5 && OTHER_AGENCIES.every((a) => a.does.length > 25));
// RADCO covers both lanes, which is why it is worth noticing.
check('RADCO is noted as covering park models AND HUD, so one agency spans both lanes',
  /Park models/.test(OTHER_AGENCIES.find((a) => a.body === 'RADCO').does)
  && /HUD DAPIA and IPIA/.test(OTHER_AGENCIES.find((a) => a.body === 'RADCO').does));
// Certification is a means, not an end.
check('the chain runs certification to VIN to title to loan, in five links',
  CERT_TO_TITLE_CHAIN.length === 5
  && /ANSI A119\.5/.test(CERT_TO_TITLE_CHAIN[0])
  && /VIN/.test(CERT_TO_TITLE_CHAIN[1])
  && /NCDMV title/.test(CERT_TO_TITLE_CHAIN[2])
  && /personal property/.test(CERT_TO_TITLE_CHAIN[3])
  && /RV loan/.test(CERT_TO_TITLE_CHAIN[4]));
check('and the stakes named — it reopens the nearest builder',
  /reopens Wind River Built at ~100 miles/.test(NC_LABEL_QUESTION.whyItMatters));
// The lender question is separate and may answer differently.
check('the lender question is kept separate from the state question',
  /question for the lender, not the state/.test(NC_LABEL_QUESTION.lenderQuestion)
  && /two\s+answers need not agree/.test(NC_LABEL_QUESTION.lenderQuestion.replace(/\s+/g, ' ')));
check('the two PWA builders are recorded, Wind River now pointing at its catalogue entry',
  NEAR_MISSES.some((n) => /Wind River Built/.test(n.maker) && /PWA, not RVIA/.test(n.why))
  && NEAR_MISSES.some((n) => n.maker === 'New Frontier Design' && /PWA certified/.test(n.why)));
console.log('Wind River, read off a catalogue with real window schedules');
check('the 24 ft models are 8 ft 6 in — permit-free to tow',
  WIND_RIVER.widths.shortModelsFt === 8.5 && WIND_RIVER.widths.longModelsFt === 10
  && WIND_RIVER.permitFreeModels.length === 2);
// The two things Zook gates behind ten units, offered at the order form.
check('entry position and roofline are both buyer choices',
  /Side Entry and End Entry/.test(WIND_RIVER.entryIsAChoice)
  && WIND_RIVER.rooflineIsAChoice.length === 4
  && WIND_RIVER.rooflineIsAChoice.includes('gable'));
check('the Brooks is recorded as the most glazed elevation in the survey',
  WIND_RIVER.glazing.some((g) => /Brooks/.test(g) && /42x80 Fixed x4/.test(g)
    && /LONG wall/.test(g)));
// The thing to check before anything else.
check('the 45 ft models carry an area warning, not an assumption',
  /OVER the 400 cap/.test(WIND_RIVER.areaWarning)
  && /body dimension/.test(WIND_RIVER.areaWarning)
  && /not the advertised length/.test(WIND_RIVER.areaWarning));
// Test the LOGIC, not the wording: 6 ft must actually be above NCDOI's 5 ft
// threshold and must actually count. A mutation to "below" passed the earlier
// word-matching version of this check.
check('and their lofts are noted as counting in NC, because 6 ft clears the 5 ft test',
  /6 ft headroom/.test(WIND_RIVER.loftsCountInNc) && /COUNT/.test(WIND_RIVER.loftsCountInNc)
  && /above NCDOI/.test(WIND_RIVER.loftsCountInNc)
  && loftCountsTowardArea(6) === true && loftCountsTowardArea(4.9) === false);
check('the certifier is recorded with the open label question, not a verdict',
  /PWA/.test(WIND_RIVER.certifier) && /NC_LABEL_QUESTION/.test(WIND_RIVER.certifier));
check('and the distance advantage is stated against the alternative',
  /100 miles/.test(WIND_RIVER.where) && /700 to Zook/.test(WIND_RIVER.where));

console.log('the OOD office units — usable, but not as lettings');
check('none of the three has a bed',
  OOD_OFFICE_UNITS.units.length === 3 && OOD_OFFICE_UNITS.units.every((u) => u.beds === 0));
check('so they are recorded as neither lettable nor park models',
  /not accommodation, and not a park model/.test(OOD_OFFICE_UNITS.notLettable));
check('but they are matched to two places the plan already has for them',
  OOD_OFFICE_UNITS.whatTheyAreGoodFor.length === 3
  && OOD_OFFICE_UNITS.whatTheyAreGoodFor.some((u) => /Field Office/.test(u))
  && OOD_OFFICE_UNITS.whatTheyAreGoodFor.some((u) => /wellness or sauna/.test(u)));
// The trade that must not get lost: an amenity building is real property.
check('and the trade is stated — real property, permit, 39-year life',
  /REAL PROPERTY/.test(OOD_OFFICE_UNITS.theTrade)
  && /39-year life/.test(OOD_OFFICE_UNITS.theTrade)
  && /no vehicle classification/.test(OOD_OFFICE_UNITS.theTrade));
check('with the mirror caution raised rather than lowered for an amenity',
  /bird-strike duty is higher here/.test(OOD_OFFICE_UNITS.mirrorCaution));

check('and the closest builder is flagged as worth a call, on the corrected footing',
  NEAR_MISSES.some((n) => /roughly 100 miles from the site/.test(n.why)
    && /too good not to make it/.test(n.why)
    && /PWA is not a lesser certification/.test(n.why))
  && NEAR_MISSES.some((n) => /SUPERSEDED/.test(n.maker) && /WIND_RIVER/.test(n.model)));
// The reason to be careful with that call, which must not be edited away: their
// own explainer describes park models the way NC forbids.
check('and their hardwiring claim is kept, because it contradicts the mobility test',
  NEAR_MISSES.some((n) => /Wind River Built/.test(n.maker)
    && /hardwired into an electric grid/.test(n.why)
    && /opposite of what NC requires/.test(n.why)));

console.log('the partnering structure already exists, and it is not importing');
check('the design-house plus RVIA-builder structure is recorded with its example',
  /New Frontier Design/.test(DESIGN_PLUS_BUILDER.example)
  && /RVIA-member manufacturer builds, seals and carries the liability/.test(DESIGN_PLUS_BUILDER.structure));
check('and why it beats importing is stated',
  /No customs chain/.test(DESIGN_PLUS_BUILDER.whyItBeatsImporting)
  && /already under RVIA audit/.test(DESIGN_PLUS_BUILDER.whyItBeatsImporting));
check('the two Lunas are explicitly kept apart',
  /Same name, different units/.test(DESIGN_PLUS_BUILDER.note)
  && /8 ft 6 in wide — permit-free/.test(DESIGN_PLUS_BUILDER.note));
check('and Luna\'s own record now carries the RVIA seal and the window wall',
  /RVIA seal to ANSI A119\.5/.test(OBSERVED_UNITS.find((u) => u.model === 'Luna').glassEvidence)
  && /expansive window wall at one end/.test(OBSERVED_UNITS.find((u) => u.model === 'Luna').glassEvidence));
check('Elevation is recorded as rejected, with the window-versus-wall reason',
  NEAR_MISSES.some((n) => n.maker === 'Elevation' && /not a glass wall/.test(n.why)));
check('and no rejected maker is still sitting in the catalogue',
  NEAR_MISSES.every((n) => !OBSERVED_UNITS.some((u) => u.maker === n.maker)));
check('the bar is written down, naming what does NOT count as evidence',
  /glass WALL or facade/.test(SURVEY.bar) && /not evidence/.test(SURVEY.bar)
  && /neither is a rendering/.test(SURVEY.bar));
// Unknown is its own answer. Keeping it separate from "rejected" is what stops
// a rendering being promoted to evidence a second time.
check('the awaiting box is empty and the count agrees',
  UNVERIFIED.length === 0 && SURVEY.awaitingEvidence === 0);
check('nothing rejected is sitting in the catalogue',
  NEAR_MISSES.every((n) => !OBSERVED_UNITS.some((u) => u.maker === n.maker)));
check('the size-threshold wording is still called out where it appears',
  directed.some((u) => u.openQuestions.some((q) => /about size/.test(q))));
check('and the folding-door width is an open question, not an assumption',
  directed.every((u) => u.openQuestions.some((q) => /How wide is the folding door/.test(q))));
check('the permit-free unit is remembered even though it failed the glass test',
  NEAR_MISSES.some((n) => /no permit, escort or route approval/.test(n.why)));

console.log('reversed plans, and one maker whose guidance contradicts the kit');
check('Zook gate reversed plans behind volume; ÖÖD do not say either way',
  MIRRORING_BY_MAKER.Zook.availability === 'volume-only'
  && MIRRORING_BY_MAKER['ÖÖD'].availability === 'unknown');
check('the Zook position is quoted rather than paraphrased',
  /not customizable when ordered as a single unit/.test(MIRRORING_BY_MAKER.Zook.quote));
check('the maker records agree with the unit records',
  OBSERVED_UNITS.filter((u) => u.maker === 'Zook').every((u) => u.mirroring === 'volume-only')
  && OBSERVED_UNITS.filter((u) => u.maker === 'ÖÖD').every((u) => u.mirroring === 'unknown'));
// The conflict is the single most consequential thing in this file.
check('ÖÖD\'s tow-bar advice is recorded verbatim against Zook\'s requirement',
  /tow bar of the chassis can be hidden or removed/.test(OOD_CLASSIFICATION_CONFLICT.theRisk)
  && /must remain ATTACHED to its wheels/.test(OOD_CLASSIFICATION_CONFLICT.conflictsWith));
check('and their wording is flagged as designed-to-meet, not certified',
  OOD_CLASSIFICATION_CONFLICT.theirWording === 'designed to meet Park Model RV standards');
check('it is to be resolved before an order, with three named actions',
  OOD_CLASSIFICATION_CONFLICT.resolveBefore === 'order'
  && OOD_CLASSIFICATION_CONFLICT.actions.length === 3
  && OOD_CLASSIFICATION_CONFLICT.actions.some((a) => /in writing, not "designed to meet"/.test(a)));
check('customisation unlocks at ten units, and nine is not ten',
  CUSTOMISATION.unlockAtUnits === 10
  && customisationAvailableAt(10) === true && customisationAvailableAt(9) === false);

console.log('where the glass is, and which way the door faces');
const gable = { ...u0, glassWall: 'gable', doorAtFractionFromGlass: 0.85 };
const side = { ...u0, glassWall: 'side', doorAtFractionFromGlass: 0.5 };
check('a gable glass wall faces back along the length',
  near(glassFacing(gable).y, -1) && near(glassReachFt(gable), 21) && near(glassWidthFt(gable), 12));
// The side-glass case is the whole reason ÖÖD is different: the glass wall is
// the LONG wall, so it is more than three times as wide.
check('a side glass wall faces across, and is the LONG wall',
  near(glassFacing(side).x, 1) && near(glassReachFt(side), 6) && near(glassWidthFt(side), 42));
check('so a side-glass view corridor is far wider than a gable one',
  area(viewCorridor(side)) > area(viewCorridor(gable))
  && near(area(viewCorridor(side)), 42 * VIEW_CLEAR_FT, 0.01)
  && near(area(viewCorridor(gable)), 12 * VIEW_CLEAR_FT, 0.01));
check('the door sits where it actually is, not at the middle of the wall',
  near(doorPoint(gable).x, 6) && near(doorPoint(gable).y, 42 * 0.35)
  && !near(doorPoint(gable).y, 0));
check('mirroring flips a side door and leaves the exit alone',
  near(doorFacing(gable).x, 1) && near(doorFacing({ ...gable, mirrored: true }).x, -1)
  && JSON.stringify(towSweep(gable)) === JSON.stringify(towSweep({ ...gable, mirrored: true })));
check('whereas rotating 180 moves the door AND reverses the exit',
  JSON.stringify(towSweep(gable)) !== JSON.stringify(towSweep({ ...gable, rotDeg: 180 })));

console.log('every layout: doors land, glass lands, views are open, units can leave');
const buildable = LAYOUTS.filter((l) => !l.rejected);
check('five layouts covering one, two and three units, one of them refused',
  LAYOUTS.length === 5 && buildable.length === 4
  && [1, 2, 3].every((n) => buildable.some((l) => l.unitCount === n)));
check('every layout places exactly the units it claims',
  LAYOUTS.every((l) => l.units.length === l.unitCount));
check('every buildable layout lands every door on a deck',
  buildable.every(everyDoorLands),
  buildable.filter((l) => !everyDoorLands(l)).map((l) => l.id).join());
check('and lands every glass wall on a deck',
  buildable.every((l) => l.units.every((u) => glassOpensOntoDeck(u, l))));
check('and leaves every glass wall open ground to look at',
  buildable.every((l) => l.units.every((u) => glassHasView(u, l))));
check('and lets every unit tow out',
  buildable.every(layoutTowsClear));
check('and keeps the units far enough apart to read as separate',
  MIN_SEPARATION_FT === 8
  && buildable.filter((l) => l.unitCount > 1).every((l) => minGapFt(l) > MIN_SEPARATION_FT));
check('units sit square — no angled pads, no bevelled framing',
  ORTHOGONAL_ONLY === true && LAYOUTS.every(isOrthogonal)
  && isOrthogonal({ units: [{ rotDeg: 14 }] }) === false);

console.log('the refused layout fails on ONE thing, and it is not a structural one');
const facing = layoutById('glass-pair-facing');
check('it is recorded as refused',
  typeof facing.rejected === 'string' && /commercially/.test(facing.rejected));
// It passes every structural test. That is what makes it worth recording — the
// failure is commercial, and no amount of engineering rescues it.
check('it passes tow, separation, orthogonality, doors and glass-onto-deck',
  layoutTowsClear(facing) === true && minGapFt(facing) > MIN_SEPARATION_FT
  && isOrthogonal(facing) === true && everyDoorLands(facing) === true
  && facing.units.every((u) => glassOpensOntoDeck(u, facing)) === true);
check('and fails only because both glass walls look into each other',
  facing.units.every((u) => glassHasView(u, facing) === false)
  && everyGlassWorks(facing) === false);
check('the view check is what separates it from the shapes that work',
  buildable.every(everyGlassWorks) && everyGlassWorks(facing) === false);

console.log('the price of a door at the far end from the glass');
check('the flank strip is derived from the unit length, not stored',
  FLANK_STRIP_WIDTH_FT === 8 && flankStripCostSqFt({ lengthFt: 32 }) === 256
  && flankStripCostSqFt({ lengthFt: 26.08 }) === 209 && flankStripCostSqFt({ lengthFt: 0 }) === 0);
const comb = deckAreaSqFt(layoutById('glass-comb-three'));
const mirror = deckAreaSqFt(layoutById('mirror-contour-three'));
check('three gable-glass units need 2208 sq ft of deck',
  comb === 2208, String(comb));
check('three side-glass units need 626 — because glass and door share a wall',
  mirror === 626, String(mirror));
check('so the side-glass arrangement is more than three times as deck-efficient',
  comb / mirror > 3);
check('deck area is summed from the polygons, not declared',
  deckAreaSqFt({ decks: [] }) === 0
  && deckAreaSqFt({ decks: [{ outline: sq }] }) === 100);
check('three layouts need reversed plans and the rest do not',
  buildable.filter(requiresMirroring).map((l) => l.id).join() === 'glass-pair-corner'
  && mirroredUnits(layoutById('glass-pair-corner')).join() === 'B');

console.log('the manufacturer\'s own pad, access and foundation rules');
check('the pad is stone 4-5 in or concrete 4-6 in, running 1 ft past the unit',
  PAD_SPEC.stoneDepthIn[0] === 4 && PAD_SPEC.stoneDepthIn[1] === 5
  && PAD_SPEC.concreteDepthIn[0] === 4 && PAD_SPEC.concreteDepthIn[1] === 6
  && PAD_SPEC.marginPastUnitFt === 1);
// Settles the elevated-cabin question on grounds that are not tax grounds.
check('pier and beam, crawl space and pit foundations are all forbidden',
  PROHIBITED_FOUNDATIONS.length === 3
  && foundationAllowed('timber pier and beam frame') === false
  && foundationAllowed('crawl space') === false
  && foundationAllowed('crushed stone pad') === true);
check('and the wheels stay attached, blocked up rather than bearing',
  /must remain ATTACHED to its wheels/.test(PAD_SPEC.wheelsStayOn)
  && /not RESTING on its wheels/.test(PAD_SPEC.blocking));
check('access is 18 ft wide with 16 ft of clearance both ways',
  DELIVERY_ACCESS.straightWidthFt === 18 && DELIVERY_ACCESS.straightClearanceFt === 16
  && DELIVERY_ACCESS.verticalClearanceFt === 16);
check('corner clearance is DERIVED from unit width, not stored',
  cornerClearanceFt(8.5) === 24.5 && cornerClearanceFt(12) === 28 && cornerClearanceFt(0) === 16);
check('so the widest unit in the catalogue costs 2.67 ft more at every corner',
  cornerSavingFt(13.83, 11.16) === 2.67 && cornerSavingFt(11.16, 11.16) === 0);
check('delivery is curbside by default and site prep is the customer\'s scope',
  DELIVERY_ACCESS.notes.some((n) => /Curbside is the delivery policy/.test(n))
  && DELIVERY_ACCESS.notes.some((n) => /does not do site preparation/.test(n)));
check('the delegated-skirting risk keeps the maker\'s own wording',
  /Skirting to be done by Customer/.test(SKIRTING_IS_DELEGATED.deliveryScope)
  && /Never masonry/.test(SKIRTING_IS_DELEGATED.instruction));

if (failures > 0) { console.error(`\nsite-composition battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nsite-composition battery clean');
