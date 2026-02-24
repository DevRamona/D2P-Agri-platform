const fs = require("fs");
const path = require("path");

const store_anonymized_feedback = async (userFeedback, imageId, correctedLabel) => {
  const saveFeedback = String(process.env.SAVE_FEEDBACK || "false").toLowerCase() === "true";
  if (!saveFeedback) {
    return { stored: false, reason: "disabled" };
  }

  const dir = path.resolve(process.cwd(), process.env.FEEDBACK_DIR || "data/feedback");
  await fs.promises.mkdir(dir, { recursive: true });

  const record = {
    imageId,
    userFeedback,
    correctedLabel: correctedLabel || null,
    createdAt: new Date().toISOString(),
  };

  const filePath = path.join(dir, `${Date.now()}-${imageId || "unknown"}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
  return { stored: true, filePath };
};

module.exports = { store_anonymized_feedback };
