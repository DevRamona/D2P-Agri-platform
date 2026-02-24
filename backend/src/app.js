const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const buyerRoutes = require("./routes/buyerRoutes");
const diseaseRoutes = require("./routes/diseaseRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use("/payments", paymentRoutes);
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use("/auth", authRoutes);
app.use("/farmer", require("./routes/farmerRoutes"));
app.use("/buyer", buyerRoutes);
app.use("/api/disease", diseaseRoutes);

app.use(errorHandler);

module.exports = { app };
