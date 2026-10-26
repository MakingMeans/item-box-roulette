import { SoundPlayer } from "./sound";
import type { Roulette } from "./types";
import { RouletteView } from "./ui/rouletteView";

// Fixed data until persistence lands.
const sample: Roulette = {
  id: crypto.randomUUID(),
  name: "Series",
  items: ["Stranger Things", "The Office", "Breaking Bad", "Dark", "Arcane"].map((name) => ({
    id: crypto.randomUUID(),
    name,
    image: null,
  })),
};

const SPEAKER_ON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none"/></svg>`;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="stage">
    <button class="icon-button mute-button" type="button"></button>
    <section class="roulette"></section>
  </main>
`;

let muted = false;
const sound = new SoundPlayer(muted);
const view = new RouletteView(app.querySelector(".roulette")!, sound, () => null);
view.setItems(sample.items);

const muteButton = app.querySelector<HTMLButtonElement>(".mute-button")!;
function renderMute() {
  muteButton.innerHTML = muted ? SPEAKER_OFF : SPEAKER_ON;
  muteButton.title = muted ? "Activar sonido" : "Silenciar";
  muteButton.setAttribute("aria-pressed", String(muted));
}
muteButton.addEventListener("click", () => {
  muted = !muted;
  sound.setMuted(muted);
  renderMute();
});
renderMute();

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
}

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat || isTextInput(event.target)) return;
  // Also stops a focused button from treating Space as its own click.
  event.preventDefault();
  void view.spin();
});
