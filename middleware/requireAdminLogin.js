function requireAdminLogin(req, res, next) {
    if (!req.session?.admin) {
      return res.redirect('/login.html');
    }
    next();
  }
  
  module.exports = requireAdminLogin;
  