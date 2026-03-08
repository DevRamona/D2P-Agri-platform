const humanize = (value) =>
  String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildExplanationSummary = ({
  cropType,
  disease,
  candidateDisease,
  confidence,
  warnings,
  isUncertain,
  uncertaintyReasons,
  thresholdApplied,
}) => {
  const confidencePct = Math.round(Number(confidence || 0) * 100);
  const warningText = Array.isArray(warnings) && warnings.length > 0 ? ` Image quality warning: ${warnings.join(", ")}.` : "";
  const reasonsText =
    Array.isArray(uncertaintyReasons) && uncertaintyReasons.length > 0
      ? ` Reason: ${uncertaintyReasons.join(" ")}.`
      : "";
  const suggestedLabel = String(candidateDisease || disease || "unknown").toLowerCase();

  if (Boolean(isUncertain) || String(disease).toLowerCase() === "uncertain") {
    return `${humanize(cropType)} scan is uncertain (${confidencePct}% confidence). Retake 2-3 clear photos (front/back leaf and whole plant) before treatment. Most likely class right now: ${humanize(
      suggestedLabel,
    )}. Confidence gate: ${Math.round(Number(thresholdApplied || 0) * 100)}%.${warningText}${reasonsText}`.trim();
  }

  if (String(disease).toLowerCase() === "healthy") {
    return `${humanize(cropType)} leaf appears healthy at ${confidencePct}% confidence. Continue monitoring and keep taking clear photos over time.${warningText}`.trim();
  }

  if (confidencePct < 65) {
    return `${humanize(cropType)} leaf may show signs of ${humanize(disease)}, but confidence is low (${confidencePct}%). Capture additional close-up and full-plant photos before taking aggressive treatment actions.${warningText}`.trim();
  }

  return `${humanize(cropType)} leaf shows patterns consistent with ${humanize(disease)} (${confidencePct}% confidence). Confirm with more photos or an agronomist if spread is rapid.${warningText}`.trim();
};

module.exports = { buildExplanationSummary };
