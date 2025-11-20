/**
 * Middleware to check for a specific user role from Clerk's session claims.
 * @param {string|string[]} requiredRoles - The role(s) required to access the route (e.g., 'seller' or ['seller', 'admin']).
 */
exports.requireRole = (requiredRoles) => {
  return (req, res, next) => {
    // ClerkExpressRequireAuth middleware should have already run and populated req.auth
    if (!req.auth || !req.auth.sessionClaims) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    const userRole = req.auth.sessionClaims.metadata?.role;
    const rolesToCheck = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!userRole) {
      return res.status(403).json({ message: 'Forbidden: Role information is missing from your session token. Please sign out and sign back in.' });
    }
    
    if (!rolesToCheck.includes(userRole)) {
      return res.status(403).json({ message: `Forbidden: Your role ('${userRole}') does not have permission. Required: '${rolesToCheck.join(' or ')}'.` });
    }
    next();
  };
};