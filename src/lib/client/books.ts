export const BOOK_COLORS = ["#2F5D8A", "#7A3E5C", "#2E6B5A", "#8A5A1E", "#4E6B2E"];
const ORDER = ["python-programming", "machine-learning", "data-science", "business-management", "environmental-science"];
const SHORT: Record<string, string> = {
  "python-programming": "Python", "machine-learning": "Machine Learning", "data-science": "Data Science",
  "business-management": "Business", "environmental-science": "Environment",
};
export const colorFor = (slug?: string | null) => (slug && ORDER.includes(slug) ? BOOK_COLORS[ORDER.indexOf(slug)] : "#5E554B");
export const shortFor = (slug?: string | null) => (slug && SHORT[slug]) || "Your PDF";
export const coverBg = (slug?: string | null) => {
  const c = colorFor(slug);
  return `linear-gradient(150deg, ${c} 0%, ${c}dd 55%, #1C1712 140%)`;
};
