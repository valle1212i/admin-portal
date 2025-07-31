router.get("/cases", async (req, res) => {
    try {
      const cases = await Case.find().sort({ createdAt: -1 }).lean();
      const populated = await Promise.all(
        cases.map(async (c) => {
          const customer = await Customer.findById(c.customerId).lean();
          return {
            sessionId: c.sessionId,
            customerId: c.customerId,
            topic: c.topic,
            description: c.description,
            timestamp: c.createdAt,
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
  