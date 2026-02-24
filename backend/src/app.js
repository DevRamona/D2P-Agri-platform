const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const diseaseRoutes = require("./routes/diseaseRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use("/auth", authRoutes);
app.use("/farmer", require("./routes/farmerRoutes"));
app.use("/api/disease", diseaseRoutes);

app.use(errorHandler);

module.exports = { app };
