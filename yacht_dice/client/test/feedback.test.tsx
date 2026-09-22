import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyScorecard } from "@yacht/shared";
import { qualifications } from "../src/feedback/qualifications";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionFeedback } from "../src/components/ActionFeedback";

test("celebrations exclude choice and hide its empty overlay without changing table highlights", () => {
  const render = (dice: number[]) =>
    renderToStaticMarkup(
      <ActionFeedback
        intro={false}
        banner
        combos={qualifications(dice, emptyScorecard())}
        recorded={null}
        eventKey="roll"
      />,
    );
  assert.doesNotMatch(render([1, 1, 2, 5, 6]), /combo-feedback|CHOICE/);
  const yacht = render([6, 6, 6, 6, 6]);
  assert.doesNotMatch(yacht, /CHOICE|data-category="choice"/);
  assert.match(yacht, /FOUR OF A KIND/);
  assert.match(yacht, /FULL HOUSE/);
  assert.match(yacht, /YACHT/);
  const straight = render([1, 2, 3, 4, 5]);
  assert.match(straight, /SMALL STRAIGHT/);
  assert.match(straight, /LARGE STRAIGHT/);
  assert.equal(
    qualifications([1, 1, 2, 5, 6], emptyScorecard())[0]?.category,
    "choice",
  );
});

test("choice is normal and excluded from maximum; straights use actual scores", () => {
  assert.deepEqual(qualifications([1, 2, 3, 4, 6], emptyScorecard()), [
    { category: "choice", score: 16, highlight: "normal" },
    { category: "smallStraight", score: 15, highlight: "special" },
  ]);
  assert.deepEqual(
    qualifications([1, 2, 3, 4, 5], emptyScorecard()).map((q) => [
      q.category,
      q.highlight,
    ]),
    [
      ["choice", "normal"],
      ["smallStraight", "normal"],
      ["largeStraight", "special"],
    ],
  );
});

test("all tied eligible maxima are special; used categories including zero are excluded", () => {
  const scores = { ...emptyScorecard(), yacht: 0, choice: 15 };
  assert.deepEqual(qualifications([3, 3, 3, 3, 3], scores), [
    { category: "fourOfAKind", score: 15, highlight: "special" },
    { category: "fullHouse", score: 15, highlight: "special" },
  ]);
  assert.deepEqual(scores, { ...emptyScorecard(), yacht: 0, choice: 15 });
  assert.deepEqual(qualifications([1, 1, 2, 5, 6], emptyScorecard()), [
    { category: "choice", score: 15, highlight: "normal" },
  ]);
});

test("yacht qualifies as full house; repeated results have identical pure classification", () => {
  const dice = [6, 6, 6, 6, 6];
  const scores = emptyScorecard();
  const result = qualifications(dice, scores);
  assert.deepEqual(
    result.map((q) => [q.category, q.highlight]),
    [
      ["choice", "normal"],
      ["fourOfAKind", "normal"],
      ["fullHouse", "normal"],
      ["yacht", "special"],
    ],
  );
  assert.deepEqual(qualifications(dice, scores), result);
  for (const candidate of result) scores[candidate.category] = 0;
  assert.deepEqual(qualifications(dice, scores), []);
});
