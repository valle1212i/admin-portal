const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const Customer = require("../models/Customer");

// 📂 Hämta alla supportärenden
router.get("/", async (req, res) => {
  try {
    const cases = await Case.find().sort({ createdAt: -1 }).lean();

    const populated = await Promise.all(
      cases.map(async (c) => {
        const customer = await Customer.findById(c.customerId).lean();
        return {
          caseId: c._id,
          sessionId: c.sessionId,
          customerId: c.customerId,
          topic: c.topic,
          description: c.description,
          status: c.status,
          createdAt: c.createdAt,
          assignedAdmin: c.assignedAdmin,
          customerName: customer?.name || "Okänd"
        };
      })
    );

    res.json(populated);
  } catch (err) {
    console.error("❌ Kunde inte hämta cases:", err);
    res.status(500).json({ message: "Fel vid hämtning av ärenden" });
  }
});

// ✅ NY: Hämta alla ärenden för en specifik kund
router.get("/customer/:customerId", async (req, res) => {
    const { customerId } = req.params;
  
    try {
      const cases = await Case.find({ customerId }).sort({ createdAt: -1 }).lean();
      res.json(cases);
    } catch (err) {
      console.error("❌ Fel vid hämtning av ärenden för kund:", err);
      res.status(500).json({ message: "Fel vid hämtning av ärenden" });
    }
  });


// 🧾 Hämta metadata för ett ärende via sessionId
router.get("/meta/:sessionId", async (req, res) => {
  try {
    const caseDoc = await Case.findOne({ sessionId: req.params.sessionId }).lean();
    if (!caseDoc) {
      return res.status(404).json({ message: "Case saknas" });
    }

    const customer = await Customer.findById(caseDoc.customerId).lean();

    res.json({
      _id: caseDoc._id,
      sessionId: caseDoc.sessionId,
      customerId: caseDoc.customerId,
      topic: caseDoc.topic,
      description: caseDoc.description,
      status: caseDoc.status,
      assignedAdmin: caseDoc.assignedAdmin,
      adminAssignmentHistory: caseDoc.adminAssignmentHistory || [],
      messages: caseDoc.messages,
      internalNotes: caseDoc.internalNotes || [],
      createdAt: caseDoc.createdAt,
      customerName: customer?.name || "Okänd",
      customerEmail: customer?.email || "" // Add customer email
    });
  } catch (err) {
    console.error("❌ Fel vid hämtning av case-meta:", err);
    res.status(500).json({ message: "Serverfel" });
  }
});

// 🔁 Uppdatera ansvarig admin för ett ärende via sessionId
router.post("/assign-admin", async (req, res) => {
  try {
    const { sessionId, adminId, assignedBy } = req.body;

    if (!sessionId || !adminId) {
      return res.status(400).json({ success: false, message: "sessionId och adminId krävs" });
    }

    // Get admin details from AdminPanel.adminportal.adminusers
    const Admin = require("../models/Admin");
    const assignedAdmin = await Admin.findById(adminId).lean();
    const assignedByAdmin = assignedBy ? await Admin.findById(assignedBy).lean() : null;

    if (!assignedAdmin) {
      return res.status(404).json({ success: false, message: "Admin kunde inte hittas" });
    }

    // Get current case to check if there's already an assigned admin
    const currentCase = await Case.findOne({ sessionId }).lean();
    if (!currentCase) {
      return res.status(404).json({ success: false, message: "Ärendet kunde inte hittas" });
    }

    // Determine action type
    let action = "assigned";
    if (currentCase.assignedAdmin && currentCase.assignedAdmin.toString() !== adminId) {
      action = "reassigned";
    }

    // Create assignment history entry
    const assignmentEntry = {
      adminId: assignedAdmin._id,
      adminName: assignedAdmin.name,
      adminEmail: assignedAdmin.email,
      assignedBy: assignedByAdmin ? assignedByAdmin._id : assignedAdmin._id,
      assignedByName: assignedByAdmin ? assignedByAdmin.name : assignedAdmin.name,
      assignedAt: new Date(),
      action: action
    };

    // Update case with new admin assignment and history
    const updated = await Case.findOneAndUpdate(
      { sessionId },
      { 
        assignedAdmin: adminId,
        $push: { adminAssignmentHistory: assignmentEntry }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Ärendet kunde inte uppdateras" });
    }

    console.log(`✅ Admin tilldelad: ${assignedAdmin.name} till ärende ${sessionId}`);

    res.json({ 
      success: true, 
      assignedAdmin: {
        _id: assignedAdmin._id,
        name: assignedAdmin.name,
        email: assignedAdmin.email
      },
      action: action
    });
  } catch (err) {
    console.error("❌ Kunde inte uppdatera ansvarig admin:", err);
    res.status(500).json({ success: false, message: "Serverfel vid uppdatering" });
  }
});

// 🔁 Uppdatera status för ett ärende
router.post("/update-status", async (req, res) => {
  const { sessionId, status } = req.body;

  if (!sessionId || !status) {
    return res.status(400).json({ success: false, message: "sessionId och status krävs." });
  }

  try {
    const updated = await Case.findOneAndUpdate(
      { sessionId },
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Ärende ej hittat." });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid uppdatering av status:", err);
    res.status(500).json({ success: false });
  }
});

// 📝 Lägg till intern anteckning
router.post("/add-note", async (req, res) => {
  const { sessionId, note } = req.body;

  if (!sessionId || !note) {
    return res.status(400).json({ success: false, message: "sessionId och note krävs." });
  }

  try {
    const updated = await Case.findOneAndUpdate(
      { sessionId },
      { $push: { internalNotes: { note, timestamp: new Date() } } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Ärende ej hittat." });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid sparande av anteckning:", err);
    res.status(500).json({ success: false });
  }
});

// 💬 Skicka meddelande till kund (lägg till i messages och uppdatera kundens supporthistorik)
router.post("/send-message", async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ success: false, message: "sessionId och message krävs." });
  }

  try {
    // Get admin info from session
    const adminName = req.session?.admin?.name || "Admin";
    const adminEmail = req.session?.admin?.email || "";

    const msg = {
      sender: "admin",
      senderName: adminName,
      senderEmail: adminEmail,
      message,
      timestamp: new Date()
    };

    const caseDoc = await Case.findOneAndUpdate(
      { sessionId },
      { $push: { messages: msg } },
      { new: true }
    );

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: "Ärende ej hittat." });
    }

    // OBS! Lägg till denna rad – saknades:
    const customerId = caseDoc.customerId;

    const supportItem = {
      caseId: caseDoc._id.toString(),
      topic: caseDoc.topic || "Okänt ärende",
      date: new Date(),
      status: caseDoc.status || "Pågående"
    };

    await Customer.findByIdAndUpdate(
      customerId,
      { $push: { supportHistory: supportItem } },
      { new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fel vid skickande av meddelande:", err);
    res.status(500).json({ success: false });
  }
});

// 📨 Customer response endpoint (called from customer portal)
router.post("/:caseId/customer-response", async (req, res) => {
  try {
    const { caseId } = req.params;
    const { message, senderName, senderEmail } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message required" });
    }

    const customerMessage = {
      sender: "customer",
      senderName: senderName || "Customer",
      senderEmail: senderEmail || "",
      message,
      timestamp: new Date()
    };

    const caseDoc = await Case.findByIdAndUpdate(
      caseId,
      { 
        $push: { messages: customerMessage },
        status: "open" // Auto-update to open when customer responds
      },
      { new: true }
    );

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    res.json({ success: true, message: "Response received" });
  } catch (err) {
    console.error("❌ Error saving customer response:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🧾 Hämta ett ärende via dess MongoDB _id (LÄGG DENNA SIST!)
router.get("/:id", async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id).lean();
    if (!caseDoc) {
      return res.status(404).json({ message: "Ärende hittades inte" });
    }

    const customer = await Customer.findById(caseDoc.customerId).lean();

    res.json({
      ...caseDoc,
      customerName: customer?.name || "Okänd"
    });
  } catch (err) {
    console.error("❌ Kunde inte hämta ärendet:", err);
    res.status(500).json({ message: "Fel vid hämtning av ärendet" });
  }
});

// GET /api/cases/customer/:customerId - Fetch cases for specific customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status = 'open', limit = 10, page = 1 } = req.query;
    const tenant = req.get('x-tenant') || 'default';
    
    console.log('🔍 Admin Portal: Fetching cases for customer:', { customerId, status, tenant });

    // Map Swedish status to English for database query
    const statusMapping = {
      'Öppen': 'open',
      'Nytt': 'new', 
      'Arbetande': 'in_progress',
      'Väntar svar': 'waiting',
      'On Hold': 'on_hold',
      'Stängt': 'closed',
      'open': 'open',
      'new': 'new',
      'in_progress': 'in_progress',
      'waiting': 'waiting',
      'on_hold': 'on_hold',
      'closed': 'closed'
    };
    
    const dbStatus = statusMapping[status] || 'open';
    
    // Query AdminPanel.adminportal.cases collection
    const query = { 
      customerId, 
      ...(tenant !== 'default' && { tenant }),
      ...(status !== 'all' && { status: dbStatus })
    };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const cases = await Case.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Case.countDocuments(query);

    console.log('✅ Admin Portal: Found cases:', { 
      customerId, 
      count: cases.length, 
      total,
      status: dbStatus 
    });

    res.json({
      success: true,
      data: cases,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Admin Portal: Error fetching customer cases:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cases',
      error: error.message
    });
  }
});

module.exports = router;
