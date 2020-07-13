const express = require("express");
const app = express();
const { join } = require("path");
const api = require("./app/api.js");
const logger = require("morgan");

const PORT = process.env.PORT || 4000;
const DIST_FOLDER = join(process.cwd(), "./dist/browser");

app.use(logger("dev"));

// my custom API
app.use("/api/", api);

app.listen(PORT, () => {
  console.log(`Node Express server listening on http://localhost:${PORT}`);
});
