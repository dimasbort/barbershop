import jwt from "jsonwebtoken";

export function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
