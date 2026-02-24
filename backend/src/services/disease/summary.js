const humanize = (value) =>
  String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildExplanationSummary = ({ cropType, disease, confidence, warnings }) => {
  const confidencePct = Math.round(Number(confidence || 0) * 100);
  const warningText = Array.isArray(warnings) && warnings.length > 0 ? ` Image quality warning: ${warnings.join(", ")}.` : "";

  if (String(disease).toLowerCase() === "healthy") {
    return `${humanize(cropType)} leaf appears healthy at ${confidencePct}% confidence. Continue monitoring and keep taking clear photos over time.${warningText}`.trim();
  }

  if (confidencePct < 65) {
    return `${humanize(cropType)} leaf may show signs of ${humanize(disease)}, but confidence is low (${confidencePct}%). Capture additional close-up and full-plant photos before taking aggressive treatment actions.${warningText}`.trim();
  }

  return `${humanize(cropType)} leaf shows patterns consistent with ${humanize(disease)} (${confidencePct}% confidence). Confirm with more photos or an agronomist if spread is rapid.${warningText}`.trim();
};

module.exports = { buildExplanationSummary };
