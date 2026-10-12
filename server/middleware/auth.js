import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "na_secret_na_istam";

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Access denied. No token provided." });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Access denied. Invalid token format." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("JWT ERROR:", err.message);
    res.status(401).json({ error: "Invalid token." });
  }
}

export { JWT_SECRET };
