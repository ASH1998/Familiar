/**
 * Title screen and ending card.
 *
 * Structure follows the RUNE GOBLIN reference: the title screen does *work* rather than being
 * a splash. It is the familiar-select — animated sprites in the cards, affinity tokens, and a
 * line of text per card saying what that affinity actually changes.
 *
 * The tagline is a hook, not an explainer. It should raise a question, not answer one.
 */

import { FAMILIARS, FAMILIAR_ORDER, type FamiliarId } from "../engine/familiars.js";
import type { Note, Score } from "../engine/score.js";
import { paint } from "./sprites.js";

const TAGLINE = [
  "Something down here has been listening since before the doors were sealed.",
  "Choose the thing that will speak back.",
];

export function showTitle(onStart: (id: FamiliarId) => void): void {
  let chosen: FamiliarId = "beholder";

  const root = document.createElement("div");
  root.id = "title";
  const inner = document.createElement("div");
  inner.className = "title-inner";
  root.appendChild(inner);

  const h1 = document.createElement("h1");
  h1.textContent = "DUNGEON FAMILIAR";
  inner.appendChild(h1);

  const tag = document.createElement("div");
  tag.className = "title-tag";
  tag.innerHTML = TAGLINE.map((l) => `<div>${l}</div>`).join("");
  inner.appendChild(tag);

  const cards = document.createElement("div");
  cards.className = "title-cards";
  inner.appendChild(cards);

  const rendered: Record<string, HTMLElement> = {};
  for (const id of FAMILIAR_ORDER) {
    const f = FAMILIARS[id];
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";

    const art = document.createElement("div");
    art.className = "card-art";
    // Motion in the cards is the point — these are the same idle clips the dungeon uses.
    const sprite = paint(document.createElement("div"), f.sprite, true);
    sprite.style.transform = "scale(2)";
    sprite.style.transformOrigin = "center";
    art.appendChild(sprite);

    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = f.name;

    const ep = document.createElement("div");
    ep.className = "card-epithet";
    ep.textContent = f.epithet;

    const stats = document.createElement("div");
    stats.className = "card-stats";
    stats.textContent = `EN ${f.energy} · WARD ${f.wardRounds}`;

    const tags = document.createElement("div");
    tags.className = "card-tags";
    tags.textContent = f.tags.join(", ");

    const aff = document.createElement("div");
    aff.className = "card-affinity";
    aff.textContent = f.affinity;

    card.append(art, name, ep, stats, tags, aff);
    card.onclick = () => {
      chosen = id;
      for (const [k, el] of Object.entries(rendered)) {
        el.classList.toggle("card--on", k === id);
      }
    };
    rendered[id] = card;
    cards.appendChild(card);
  }
  rendered[chosen]!.classList.add("card--on");

  const start = document.createElement("button");
  start.className = "title-start";
  start.textContent = "Bind the familiar";
  start.onclick = () => {
    root.remove();
    onStart(chosen);
  };
  inner.appendChild(start);

  const hint = document.createElement("div");
  hint.className = "title-hint";
  hint.innerHTML =
    "<div>Click to walk · click a prop to look at it · <b>End turn</b> hands the dungeon to the familiar.</div>" +
    "<div>The familiar has no eyes. It can only act on what you tell it. " +
    "<b>Shift+L+A</b> opens demo mode.</div>";
  inner.appendChild(hint);

  document.body.appendChild(root);
}

/** The closing card. Shown once the binding is released. */
export function showEnding(final: Score, breakdown: Note[], onRestart: () => void): void {
  const root = document.createElement("div");
  root.id = "title";
  root.classList.add("ending");
  const inner = document.createElement("div");
  inner.className = "title-inner";
  root.appendChild(inner);

  const h1 = document.createElement("h1");
  h1.textContent = "DUNGEON CLEARED";
  inner.appendChild(h1);

  const tag = document.createElement("div");
  tag.className = "title-tag";
  tag.innerHTML =
    "<div>The binding is broken and the thing that was listening is loose in the air.</div>" +
    "<div class='ending-credit'>Human + Familiar</div>";
  inner.appendChild(tag);

  // Plain-language breakdown rather than a bare number: the score exists to tell the pair
  // what they did well, and "412 points" says nothing on its own.
  const sheet = document.createElement("div");
  sheet.className = "score-sheet";
  sheet.innerHTML =
    breakdown
      .map(
        (n) =>
          `<div class="score-note">` +
          `<div class="score-note-head"><span>${n.label}</span>` +
          (n.points !== 0
            ? `<b class="${n.points > 0 ? "up" : "down"}">${n.points > 0 ? "+" : ""}${n.points}</b>`
            : `<b class="flat">—</b>`) +
          `</div><div class="score-note-detail">${n.detail}</div></div>`,
      )
      .join("") +
    `<div class="score-row score-row--total"><span>Score</span><b>${final.points}</b></div>` +
    `<div class="score-rank">${final.rank}</div>`;
  inner.appendChild(sheet);

  const again = document.createElement("button");
  again.className = "title-start";
  again.textContent = "Again";
  again.onclick = () => {
    root.remove();
    onRestart();
  };
  inner.appendChild(again);

  document.body.appendChild(root);
}
