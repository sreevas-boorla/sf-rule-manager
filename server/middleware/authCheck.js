export default function authCheck(req, res, next) {
  if (!req.session?.sf) {
    return res.status(401).json({ error: 'Not authenticated — please log in first' });
  }
  next();
}
