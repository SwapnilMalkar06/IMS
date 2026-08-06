// ====================================================================
// Phase 2: Backend Dev - Role Permission Guard Middleware
// ====================================================================

const ROLE_PERMISSIONS = {
    'ADMIN': ['READ', 'STOCK_IN', 'STOCK_OUT', 'MANAGE_PRODUCTS', 'MANAGE_USERS', 'MANAGE_SETTINGS'],
    'MANAGER': ['READ', 'STOCK_IN', 'STOCK_OUT', 'MANAGE_PRODUCTS', 'EXPORT_REPORTS'],
    'CLERK': ['READ', 'STOCK_IN', 'STOCK_OUT'],
    'AUDITOR': ['READ']
};

/**
 * Express middleware to verify if logged user role has required permission
 */
function requirePermission(permission) {
    return (req, res, next) => {
        const userRole = req.headers['x-user-role'] || 'CLERK'; // Default to Clerk if omitted

        const permissions = ROLE_PERMISSIONS[userRole] || [];

        if (!permissions.includes(permission)) {
            return res.status(403).json({
                error: `Access Denied: Role '${userRole}' does not have '${permission}' permission.`,
                requiredPermission: permission,
                userRole
            });
        }

        req.userRole = userRole;
        next();
    };
}

module.exports = { requirePermission, ROLE_PERMISSIONS };
