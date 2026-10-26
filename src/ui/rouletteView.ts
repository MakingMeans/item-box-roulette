import { buildSpinPlan, playSpin, randomInt } from "../roulette";
import { SPIN_DURATION_MS, type SoundPlayer } from "../sound";
import type { Item } from "../types";
import { createPlaceholder } from "./placeholder";

/** Changes slower than this are shown sharp; faster ones get motion blur. */
const BLUR_FREE_GAP_MS = 300;
const FASTEST_GAP_MS = 40;

/**
 * The item box: shows one face per item and flips between them during a spin.
 * Every face is built up front so switching is instant, with no image decoding mid-spin.
 */
export class RouletteView {
  private readonly box: HTMLElement;
  private readonly faces: HTMLElement;
  private readonly blur: SVGFEGaussianBlurElement;
  private readonly winnerLabel: HTMLElement;
  private readonly spinButton: HTMLButtonElement;
  private readonly hint: HTMLElement;

  private items: Item[] = [];
  private itemFaces: HTMLElement[] = [];
  private readonly idleFace: HTMLElement;
  private shown: HTMLElement;
  private spinning = false;

  constructor(
    root: HTMLElement,
    private readonly sound: SoundPlayer,
    private readonly imageUrl: (item: Item) => string | null,
  ) {
    root.innerHTML = `
      <svg class="svg-defs" aria-hidden="true">
        <filter id="motion-blur" x="-10%" y="-25%" width="120%" height="150%">
          <feGaussianBlur stdDeviation="0 0" />
        </filter>
      </svg>
      <div class="item-box">
        <div class="item-box-faces"><div class="face face-idle">?</div></div>
      </div>
      <div class="winner" aria-live="polite"></div>
      <button class="spin-button" type="button">Girar</button>
      <p class="spin-hint"></p>
    `;
    this.box = root.querySelector(".item-box")!;
    this.faces = root.querySelector(".item-box-faces")!;
    this.blur = root.querySelector("feGaussianBlur")!;
    this.winnerLabel = root.querySelector(".winner")!;
    this.spinButton = root.querySelector(".spin-button")!;
    this.hint = root.querySelector(".spin-hint")!;
    this.idleFace = root.querySelector(".face-idle")!;
    this.shown = this.idleFace;

    this.spinButton.addEventListener("click", () => void this.spin());
  }

  get isSpinning(): boolean {
    return this.spinning;
  }

  /** Replaces the items and resets the box to its idle "?" state. */
  setItems(items: Item[]) {
    this.items = items;
    for (const face of this.itemFaces) face.remove();
    this.itemFaces = items.map((item) => {
      const face = document.createElement("div");
      face.className = "face";
      face.hidden = true;
      const url = this.imageUrl(item);
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.draggable = false;
        img.decoding = "sync";
        face.append(img);
      } else {
        face.append(createPlaceholder(item));
      }
      this.faces.append(face);
      return face;
    });
    this.showFace(this.idleFace);
    this.winnerLabel.textContent = "";
    this.winnerLabel.classList.remove("show");
    this.box.classList.remove("has-winner", "celebrate");
    this.updateControls();
  }

  async spin() {
    if (this.spinning || this.items.length < 2) return;
    this.spinning = true;
    this.updateControls();
    this.winnerLabel.classList.remove("show");
    this.winnerLabel.textContent = "";
    this.box.classList.remove("has-winner", "celebrate");

    // The winner is decided here, before anything moves; the animation only stages it.
    const winner = randomInt(this.items.length);
    this.sound.startSpin();
    const plan = buildSpinPlan(this.items.length, winner, SPIN_DURATION_MS + this.sound.latencyMs);

    await playSpin(plan, (index, gap) => {
      this.showFace(this.itemFaces[index]);
      this.setMotionBlur(gap);
      if (gap === Infinity) {
        this.dropIn(this.itemFaces[index]);
      } else {
        this.sound.tick();
        this.slideIn(this.itemFaces[index], gap);
      }
    });

    this.sound.result();
    this.celebrate(this.items[winner]);
    this.spinning = false;
    this.updateControls();
  }

  private updateControls() {
    const enough = this.items.length >= 2;
    this.spinButton.disabled = this.spinning || !enough;
    this.hint.textContent = enough ? "o pulsa Espacio" : "Añade al menos 2 elementos para girar";
  }

  private showFace(face: HTMLElement) {
    if (face === this.shown) return;
    this.shown.hidden = true;
    face.hidden = false;
    this.shown = face;
  }

  /** Vertical smear proportional to speed, like the item box in the racing games. */
  private setMotionBlur(gapMs: number) {
    const speed = Math.min(1, Math.max(0, (BLUR_FREE_GAP_MS - gapMs) / (BLUR_FREE_GAP_MS - FASTEST_GAP_MS)));
    if (speed === 0) {
      this.faces.style.filter = "none";
      return;
    }
    this.blur.setAttribute("stdDeviation", `${(1.5 * speed).toFixed(2)} ${(9 * speed).toFixed(2)}`);
    this.faces.style.filter = "url(#motion-blur)";
  }

  private slideIn(face: HTMLElement, gapMs: number) {
    face.animate([{ transform: "translateY(-14%)" }, { transform: "none" }], {
      duration: Math.min(gapMs * 0.7, 110),
      easing: "ease-out",
    });
  }

  private dropIn(face: HTMLElement) {
    face.animate(
      [
        { transform: "translateY(-18%) scale(0.9)" },
        { transform: "translateY(3%) scale(1.04)", offset: 0.6 },
        { transform: "none" },
      ],
      { duration: 380, easing: "ease-out" },
    );
  }

  private celebrate(winner: Item) {
    this.winnerLabel.textContent = winner.name;
    // Force a reflow so the CSS animations restart on consecutive wins.
    void this.box.offsetWidth;
    this.box.classList.add("has-winner", "celebrate");
    this.winnerLabel.classList.add("show");
  }
}
