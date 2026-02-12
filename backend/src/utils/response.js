const success = (data) => ({ success: true, data, error: null });

const failure = (code, message, details) => ({
  success: false,
  data: null,
  error: { code, message, details: details || null },
});

module.exports = { success, failure };
