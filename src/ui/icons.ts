// Inline SVG icons (stroke-based, 24x24) styled by `.icon-button svg` / `.icon svg` in styles.css.
const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const icons = {
  plus: svg(`<path d="M12 5v14M5 12h14" fill="none"/>`),
  pencil: svg(`<path d="M4 20h4L19 9l-4-4L4 16z M14 6l4 4" fill="none"/>`),
  trash: svg(`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none"/>`),
  panel: svg(`<rect x="3" y="4" width="18" height="16" rx="2" fill="none"/><path d="M9 4v16" fill="none"/>`),
  image: svg(`<rect x="3" y="4" width="18" height="16" rx="2" fill="none"/><circle cx="9" cy="10" r="2" fill="none"/><path d="M21 17l-5-5-9 8" fill="none"/>`),
  speakerOn: svg(`<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none"/>`),
  speakerOff: svg(`<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none"/>`),
};
