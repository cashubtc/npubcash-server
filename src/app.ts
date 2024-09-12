import express, { Response } from "express";
import bodyparser from "body-parser";
import cors from "cors";
import compression from "compression";
import { requireHTTPS } from "./middleware/https";
import path from "path";
import v1Routes from "./routes/v1Routes";
import baseRoutes from "./routes/baseRoutes";
import v2Routes from "./routes/v2Routes";

const app = express();

app.use(bodyparser.json());
app.use(compression());
app.use(cors());
app.use(requireHTTPS);

app.use(baseRoutes);
app.use("/api/v1", v1Routes);
app.use("/api/v2", v2Routes);
app.use("/", express.static(path.join(__dirname, "../npubcash-website/dist")));
app.get("*", (_, res: Response) => {
  res.sendFile(path.join(__dirname, "../npubcash-website/dist/index.html"));
});

export default app;
