const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// 🔗 Skapa separat MongoDB-koppling till kundportalen
const customerConnection = mongoose.createConnection(process.env.CUSTOMER_DB_URI, {
  dbName: "kundportal",
});

// 🧱 Definiera Customer-modellen för kundportalen
const Customer = customerConnection.model(
  "Customer",
  new mongoose.Schema({}, { strict: false }),
  "customers"
);

// 🔐 Middleware för att kontrollera admin-behörighet
const requireAdminAuth = (req, res, next) => {
  if (!req.session?.admin) {
    return res.status(401).json({ 
      success: false, 
      message: "Admin-autentisering krävs" 
    });
  }
  
  // Kontrollera att admin har rätt behörighet (endast owners kan impersonera)
  if (req.session.admin.role !== 'owner' && req.session.admin.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: "Otillräcklig behörighet för impersonation" 
    });
  }
  
  next();
};

// 👤 Impersonera kund
router.post("/impersonate", requireAdminAuth, async (req, res) => {
  try {
    const { customerId, customerEmail } = req.body;
    
    if (!customerId && !customerEmail) {
      return res.status(400).json({
        success: false,
        message: "Kund-ID eller e-post krävs"
      });
    }

    // Hitta kunden
    let customer;
    if (customerId) {
      customer = await Customer.findById(customerId);
    } else if (customerEmail) {
      customer = await Customer.findOne({ email: customerEmail });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Kund hittades inte"
      });
    }

    // Skapa impersonation token med samma secret som används för sessioner
    const secret = process.env.SESSION_SECRET || 'admin_secret_key';
    console.log(`🔑 Använder secret för token: ${secret ? 'SECRET FINNS' : 'INGEN SECRET'}`);
    
    const impersonationToken = jwt.sign(
      {
        customerId: customer._id,
        customerEmail: customer.email,
        customerName: customer.name,
        impersonatedBy: req.session.admin._id,
        impersonatedByName: req.session.admin.name,
        impersonatedAt: new Date(),
        type: 'impersonation'
      },
      secret,
      { expiresIn: '1h' } // Token giltig i 1 timme
    );

    // Logga impersonation för säkerhet
    console.log(`🔐 Admin ${req.session.admin.name} (${req.session.admin.email}) impersonerar kund ${customer.name} (${customer.email})`);
    console.log(`🔑 Token skapad med secret: ${secret ? 'SECRET FINNS' : 'INGEN SECRET'}`);

    // Skapa en enkel redirect URL med token som query parameter
    const customerPortalUrl = process.env.CUSTOMER_PORTAL_URL || 'https://source-database.onrender.com';
    const redirectUrl = `${customerPortalUrl}/?impersonate=${impersonationToken}`;

    res.json({
      success: true,
      message: "Impersonation token skapad",
      redirectUrl,
      customer: {
        name: customer.name,
        email: customer.email,
        id: customer._id
      },
      token: impersonationToken
    });

  } catch (err) {
    console.error("❌ Fel vid impersonation:", err);
    res.status(500).json({
      success: false,
      message: "Internt serverfel vid impersonation"
    });
  }
});

// 🔍 Verifiera impersonation token (anropas från kundportalen)
router.options("/verify-impersonation", (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.sendStatus(200);
});

router.get("/verify-impersonation", async (req, res) => {
  try {
    const { token } = req.query;
    
    // Set CORS headers för customer portal access
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Logga request details för debugging
    console.log(`🌐 Verification request från: ${req.headers.origin || req.headers.host}`);
    console.log(`📋 Request headers: ${JSON.stringify(req.headers, null, 2)}`);
    
    console.log(`🔍 Verifierar impersonation token: ${token ? token.substring(0, 50) + '...' : 'INGEN TOKEN'}`);
    
    if (!token) {
      console.log('❌ Ingen token mottagen');
      return res.status(400).json({
        success: false,
        message: "Token krävs"
      });
    }

    // Verifiera token med samma secret som används för sessioner
    const secret = process.env.SESSION_SECRET || 'admin_secret_key';
    console.log(`🔑 Använder secret för verifiering: ${secret ? 'SECRET FINNS' : 'INGEN SECRET'}`);
    
    const decoded = jwt.verify(token, secret);
    console.log(`✅ Token verifierad för kund: ${decoded.customerName} (${decoded.customerEmail})`);
    
    if (decoded.type !== 'impersonation') {
      return res.status(400).json({
        success: false,
        message: "Ogiltig token typ"
      });
    }

    // Hitta kunden för att säkerställa att den fortfarande finns
    const customer = await Customer.findById(decoded.customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Kund hittades inte"
      });
    }

    res.json({
      success: true,
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        ...customer.toObject()
      },
      impersonation: {
        impersonatedBy: decoded.impersonatedBy,
        impersonatedByName: decoded.impersonatedByName,
        impersonatedAt: decoded.impersonatedAt
      }
    });

  } catch (err) {
    console.error("❌ Fel vid verifiering av impersonation token:", err);
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Ogiltig token"
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token har gått ut"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internt serverfel vid verifiering"
    });
  }
});

// 🚪 Direkt login för impersonation (anropas från kundportalen)
router.post("/direct-login", async (req, res) => {
  try {
    const { sessionData } = req.body;
    
    if (!sessionData) {
      return res.status(400).json({
        success: false,
        message: "Session data krävs"
      });
    }

    // Verifiera att session data är giltig
    const { customerId, customerEmail, sessionToken, isImpersonated } = sessionData;
    
    if (!isImpersonated || !sessionToken) {
      return res.status(400).json({
        success: false,
        message: "Ogiltig impersonation session"
      });
    }

    // Verifiera JWT token med samma secret som används för sessioner
    const secret = process.env.SESSION_SECRET || 'admin_secret_key';
    const decoded = jwt.verify(sessionToken, secret);
    
    if (decoded.type !== 'impersonation' || decoded.customerId !== customerId) {
      return res.status(400).json({
        success: false,
        message: "Ogiltig impersonation token"
      });
    }

    // Hitta kunden för att säkerställa att den fortfarande finns
    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Kund hittades inte"
      });
    }

    // Skapa en session för kunden
    const customerSession = {
      customerId: customer._id,
      customerEmail: customer.email,
      customerName: customer.name,
      isImpersonated: true,
      impersonatedBy: decoded.impersonatedBy,
      impersonatedByName: decoded.impersonatedByName,
      impersonatedAt: decoded.impersonatedAt,
      loginTime: new Date()
    };

    console.log(`🚪 Direkt login för impersonerad kund: ${customer.name} (${customer.email})`);

    res.json({
      success: true,
      message: "Direkt login lyckades",
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        ...customer.toObject()
      },
      session: customerSession
    });

  } catch (err) {
    console.error("❌ Fel vid direkt login:", err);
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Ogiltig session token"
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Session token har gått ut"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internt serverfel vid direkt login"
    });
  }
});

// 📋 Hämta impersonation log (för admin dashboard)
router.get("/impersonation-log", requireAdminAuth, async (req, res) => {
  try {
    // Här kan du implementera loggning av impersonation events
    // För nu returnerar vi en tom lista
    res.json({
      success: true,
      logs: []
    });
  } catch (err) {
    console.error("❌ Fel vid hämtning av impersonation log:", err);
    res.status(500).json({
      success: false,
      message: "Internt serverfel"
    });
  }
});

module.exports = router;
