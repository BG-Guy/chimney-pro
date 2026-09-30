// A single editable message the tech copies after a job to ask for a review — same "one
// slot, always overwritten" pattern as the saved route, not a library of templates.
const KEY = "chimneypro:reviewTemplate";

const DEFAULT_TEMPLATE =
  "Thanks for choosing us! If you were happy with the work, a quick review would really help us out — here's the link: ";

export function loadReviewTemplate(): string {
  return localStorage.getItem(KEY) ?? DEFAULT_TEMPLATE;
}

export function saveReviewTemplate(text: string): void {
  localStorage.setItem(KEY, text);
}
